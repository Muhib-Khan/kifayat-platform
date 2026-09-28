/**
 * Golden Groq Key Pool — rotates every configured Groq API key with
 * per-key health tracking so jobs never die on one throttled key.
 *
 * Tactics:
 *  1. Round-robin acquisition across ALL healthy keys (task-agnostic).
 *  2. Per-key cooldown: 429/5xx → 10s, doubling to 5 min (per key, not global).
 *  3. Invalid keys (401/403 "invalid api key") are disabled for the session.
 *  4. Success resets a key's health.
 *  5. chatWithRetry re-runs the SAME request on the next healthy key when the
 *     current key throttles, fails, or returns garbage (parse error).
 *  6. A 45s wall-clock budget bounds retries, so heavy jobs never hang.
 */
const Groq = require("groq-sdk");
const Settings = require("../models/Settings");
const geminiPool = require("./geminiPool");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Model strategy ──────────────────────────────────────────────────────────
// Bulk generation jobs (descriptions, titles, keywords, categories) run on the
// fast 8B model: ~5× the per-key token budget (30k TPM vs 6k) and ~3× faster
// generation. Analysis one-shots (reviews, pricing) keep the quality 70B.
const FAST_TASKS = new Set(["descriptions", "titles", "seo", "categories", "duplicates"]);
const FAST_MODEL = "llama-3.1-8b-instant";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// ── Per-key pacing ──────────────────────────────────────────────────────────
// Per-key 429 wall ≈ 6,000 REAL tokens/min (60s sliding window). We account
// ACTUAL tokens from each response's usage (not estimates), so a key's window
// is always exact — it never drifts over the wall and never trips a 429.
// When every key is over budget we WAIT — a smooth faucet at max safe speed.
const TPM_BUDGET_PER_KEY = 5_500;
const RPM_BUDGET_PER_KEY = 25;
const RPM_WINDOW_MS = 60_000;

const keyHealth = new Map(); // key -> { failures, cooldownUntil, disabled, requests: [ts], tokens: [{ts, tokens}] }
let cache = { keys: [], at: 0 };
const CACHE_TTL_MS = 60_000;
const COOLDOWN_BASE_MS = 10_000;
const COOLDOWN_MAX_MS = 300_000;
const RETRY_BUDGET_MS = 60_000;
let rrIndex = 0;
let throttles = 0; // total 429s absorbed by the pool (diagnostic)
let lastGeminiFailAt = 0;
const GEMINI_DEGRADE_MS = 60_000; // skip Gemini for 60s after any failure

function now() {
  return Date.now();
}

async function getKeys() {
  if (cache.keys.length && now() - cache.at < CACHE_TTL_MS) return cache.keys;
  const keys = [];
  const seen = new Set();
  const push = (k) => {
    const clean = String(k || "").trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      keys.push(clean);
    }
  };
  try {
    const s = await Settings.findOne({}).select("groqApiKey groqApiKeys").lean();
    (s?.groqApiKeys || []).forEach((e) => e && push(e.key));
    if (s?.groqApiKey) push(s.groqApiKey);
  } catch (_) {
    // DB unavailable — fall through to env
  }
  if (process.env.GROQ_API_KEY) push(process.env.GROQ_API_KEY);
  cache = { keys, at: now() };
  return keys;
}

async function hasKeys() {
  return (await getKeys()).length > 0;
}

async function healthyCount() {
  return healthyKeys(await getKeys()).length;
}

function healthyKeys(keys) {
  const t = now();
  return keys.filter((k) => {
    const h = keyHealth.get(k);
    if (!h) return true;
    if (h.disabled) return false;
    if (h.cooldownUntil && h.cooldownUntil > t) return false;
    return true;
  });
}

// Pick the next key strictly within its request AND token budget. If none are
// under budget, return null — callers WAIT for a window to free up. Firing at
// exhausted keys would recreate the 429 storm, so we deliberately never do it.
function acquireKey(keys, estTokens = 0) {
  const t = now();
  const healthy = healthyKeys(keys);
  if (healthy.length === 0) return null;

  const underBudget = healthy.filter((k) => {
    const h = keyHealth.get(k);
    if (!h) return true;
    const requests = (h.requests || []).filter((ts) => ts > t - RPM_WINDOW_MS);
    const tokens = (h.tokens || []).filter((e) => e.ts > t - RPM_WINDOW_MS);
    const tokensUsed = tokens.reduce((sum, e) => sum + (e.real ?? e.est), 0);
    return (
      requests.length < RPM_BUDGET_PER_KEY &&
      tokensUsed + estTokens <= TPM_BUDGET_PER_KEY
    );
  });
  if (underBudget.length === 0) return null;
  const key = underBudget[rrIndex++ % underBudget.length];

  const prev = keyHealth.get(key) || { failures: 0, cooldownUntil: 0, disabled: false };
  const requests = [...(prev.requests || []).filter((ts) => ts > t - RPM_WINDOW_MS), t];
  const tokens = [...(prev.tokens || []).filter((e) => e.ts > t - RPM_WINDOW_MS), { ts: t, est: estTokens, real: null }];
  keyHealth.set(key, { ...prev, requests, tokens });
  return key;
}

// Record ACTUAL tokens spent by the just-finished call (replaces its estimate)
function reportSuccess(key, realTokens) {
  const prev = keyHealth.get(key) || { requests: [], tokens: [] };
  const tokens = prev.tokens || [];
  const target = tokens.length ? tokens[tokens.length - 1] : null;
  if (target && target.real == null) target.real = realTokens;
  keyHealth.set(key, { ...prev, failures: 0, cooldownUntil: 0, disabled: false, tokens });
}

// Rough token estimate for acquire-time budgeting (input chars/4 + ~60% of
// max_tokens). Replaced by ACTUAL usage on success.
function estimateTokens(params) {
  let chars = 0;
  for (const m of params.messages || []) {
    if (typeof m?.content === "string") chars += m.content.length;
    else if (m?.content?.length) chars += m.content.reduce((s, c) => s + (c?.text?.length || 0), 0);
  }
  return Math.ceil(chars / 4) + Math.round((Number(params.max_tokens) || 800) * 0.6);
}

function reportSuccess(key) {
  // Keep requests/tokens window data (pacing!) — only reset failure state.
  const prev = keyHealth.get(key) || { requests: [], tokens: [] };
  keyHealth.set(key, { ...prev, failures: 0, cooldownUntil: 0, disabled: false });
}

function reportFailure(key, status, message) {
  const prev = keyHealth.get(key) || { failures: 0, cooldownUntil: 0, disabled: false, requests: [], tokens: [] };
  const msg = String(message || "").toLowerCase();
  if (status === 401 || status === 403 || /invalid.*api key|api key.*invalid|unauthorized/i.test(msg)) {
    keyHealth.set(key, { ...prev, disabled: true });
    return;
  }
  const isRate = status === 429 || /rate.?limit/i.test(msg);
  // Rate-limit 429s clear within the 60s window — short cooldown so the pool
  // recovers fast instead of cascading. Server errors double 10s → 5min.
  const base = isRate ? 5_000 : COOLDOWN_BASE_MS;
  const cooldown = Math.min(
    COOLDOWN_MAX_MS,
    base * Math.pow(2, Math.min(prev.failures, 5))
  );
  keyHealth.set(key, {
    ...prev,
    failures: prev.failures + 1,
    cooldownUntil: now() + cooldown,
  });
}

function classifyError(err) {
  const status = Number(err?.status || (err?.error && err.error.status)) || 0;
  const msg = String(err?.message || (err?.error && err.error.message) || "");
  if (status === 401 || status === 403 || /invalid.*api key|api key.*invalid/i.test(msg)) {
    return { kind: "invalid", status };
  }
  if (status === 429 || /rate.?limit/i.test(msg)) return { kind: "rate", status };
  if (status >= 500 || /overloaded|temporarily|timeout|aborted|connection|econn/i.test(msg)) {
    return { kind: "server", status };
  }
  return { kind: "other", status };
}

/**
 * High-level smart call. Bulk tasks try Gemini first (huge per-key TPM); if
 * Gemini fails (or a big batch keeps returning bad output), it falls back to
 * the Groq fleet — splitting into smaller chunks when the caller says the
 * batch is too big for Groq's 8b model to enumerate reliably.
 * @param {string} task  routes FAST_TASKS to the fast model / Gemini
 * @param {object} params  full groq.chat.completions.create body
 * @param {{parse?: (content: string) => any, budget?: number, split?: (params) => object[]}} [opts]
 *   budget: retry wall-clock ms — interactive one-shots keep the default 60s;
 *   background batch jobs pass e.g. 300_000 so throttled batches wait for a key
 *   instead of failing.
 *   split: for big batches — returns the SAME params split into ≤12-product
 *   chunks (Groq 8b can't enumerate >~24 reliably). Used only on Groq fallback.
 * @returns parsed result (if parse given) or raw content string
 */
async function chatWithRetry(task, params, { parse, budget, split } = {}) {
  // Bulk-generation tasks prefer Gemini: one key ≈ 250k TPM vs ~6k/key Groq.
  // Gemini gets a SHORT 20s try so a dead/quota'd key never burns the job's
  // budget. After any Gemini failure the router skips it for 60s (degraded),
  // falling straight to the Groq fleet — no repeated 20s dead-ends.
  if (FAST_TASKS.has(task) && now() - lastGeminiFailAt > GEMINI_DEGRADE_MS && (await geminiPool.hasKeys())) {
    try {
      return await geminiPool.chatWithRetry(task, params, { parse, budget: Math.min(budget ?? 60_000, 20_000) });
    } catch (err) {
      lastGeminiFailAt = now();
      // any failure → fall through to Groq keys
    }
  }

  // Groq 8b caps at ~24 reliable items/call — split big batches into 12s so a
  // Gemini failure never means a lost batch.
  if (split) {
    const chunks = split(params);
    if (chunks.length > 1) {
      const per = Math.max(10_000, Math.floor((budget ?? RETRY_BUDGET_MS) / chunks.length));
      const results = await Promise.all(
        chunks.map((cp) => groqLoop(task, cp, { parse, budget: per }))
      );
      // All FAST bulk parses return arrays — concat back into one result
      return results.flat(1);
    }
    params = chunks[0];
  }

  return groqLoop(task, params, { parse, budget });
}

async function groqLoop(task, params, { parse, budget } = {}) {
  const keys = await getKeys();
  if (keys.length === 0) throw new Error("No Groq API keys configured.");
  // Route bulk-generation tasks to the fast model automatically
  const fullParams = FAST_TASKS.has(task)
    ? { ...params, model: FAST_MODEL }
    : { ...params, model: params.model || DEFAULT_MODEL };
  const estTokens = estimateTokens(fullParams);
  const deadline = now() + (budget ?? RETRY_BUDGET_MS);
  let lastErr = null;

  while (now() < deadline) {
    const key = acquireKey(keys, estTokens);
    if (!key) {
      // Every key cooling or over budget — wait for one to free up.
      await sleep(1500);
      continue;
    }
    const groq = new Groq({ apiKey: key });
    try {
      const rsp = await groq.chat.completions.create(fullParams);
      const realTokens = rsp.usage?.total_tokens || estTokens;
      const content = (rsp.choices?.[0]?.message?.content || "").trim();
      if (!parse) {
        reportSuccess(key, realTokens);
        return content;
      }
      try {
        const parsed = parse(content);
        reportSuccess(key, realTokens);
        return parsed;
      } catch (parseErr) {
        // Model returned unusable output — regenerate on another key
        reportSuccess(key, realTokens);
        lastErr = parseErr;
        continue;
      }
    } catch (err) {
      const { kind } = classifyError(err);
      lastErr = err;
      if (kind === "invalid" || kind === "rate" || kind === "server") {
        if (kind === "rate") throttles++;
        reportFailure(key, err.status, err.message);
        await sleep(600 + Math.floor(Math.random() * 500));
        continue;
      }
      throw err; // non-transient (bad request etc.) — not a key problem
    }
  }

  throw lastErr || new Error(`Groq request failed after retries (task: ${task}).`);
}

/** Snapshot for logging: { total, healthy, cooling, disabled, throttles } */
function summary() {
  const keys = cache.keys;
  const t = now();
  let healthy = 0;
  let cooling = 0;
  let disabled = 0;
  for (const k of keys) {
    const h = keyHealth.get(k);
    if (!h || (h.cooldownUntil <= t && !h.disabled)) healthy++;
    else if (h.disabled) disabled++;
    else if (h.cooldownUntil > t) cooling++;
  }
  return { total: keys.length, healthy, cooling, disabled, throttles };
}

/**
 * Split a big-batch params object into ≤CHUNK-size chunks for the Groq
 * fallback (8b model can't enumerate >~24 items reliably). The caller passes
 * `buildUserContent(subBatch)` returning the user message for a sub-batch.
 * @returns {object[]} array of params objects (1 item if batch ≤ CHUNK)
 */
function splitBatchParams(params, batch, buildUserContent, CHUNK = 12) {
  const out = [];
  for (let i = 0; i < batch.length; i += CHUNK) {
    const sub = batch.slice(i, i + CHUNK);
    out.push({
      ...params,
      messages: [
        params.messages?.[0],
        { role: "user", content: buildUserContent(sub) },
      ],
    });
  }
  return out;
}

module.exports = {
  getKeys,
  hasKeys,
  healthyCount,
  chatWithRetry,
  splitBatchParams,
  summary,
  reportSuccess,
  reportFailure,
};
