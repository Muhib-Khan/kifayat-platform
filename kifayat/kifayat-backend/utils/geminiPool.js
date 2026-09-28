/**
 * Gemini Pool — second LLM provider for the key pool.
 *
 * Gemini keys carry a MUCH bigger per-key token budget (e.g. 250k TPM vs
 * ~6k/key/min for Groq free tier), so a single Gemini key can outrun the whole
 * Groq fleet. Bulk fast tasks route here first; groqKeyPool falls back to Groq
 * keys when Gemini is unavailable or a call fails.
 *
 * Same semantics as groqKeyPool.chatWithRetry: per-key health + cooldowns,
 * real-token pacing (from usageMetadata), retries across keys until a wall
 * budget expires. Uses plain fetch — no SDK.
 */
const Settings = require("../models/Settings");

// flash quota is exhausted on these keys; flash-lite works and is faster/cheaper
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const TPM_BUDGET_PER_KEY = 230_000; // user's key: 250k TPM — keep 8% headroom
const RPM_BUDGET_PER_KEY = 500;
const RPM_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 60_000;
const COOLDOWN_BASE_MS = 10_000;
const COOLDOWN_MAX_MS = 300_000;
const RETRY_BUDGET_MS = 60_000;

const keyHealth = new Map();
let cache = { keys: [], at: 0 };
let rrIndex = 0;
let throttles = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

async function getKeys() {
  if (cache.keys.length && now() - cache.at < CACHE_TTL_MS) return cache.keys;
  const keys = [];
  const seen = new Set();
  const push = (k, model) => {
    const clean = String(k || "").trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      keys.push({ key: clean, model: model || GEMINI_MODEL });
    }
  };
  try {
    const s = await Settings.findOne({}).select("geminiApiKeys").lean();
    (s?.geminiApiKeys || []).forEach((e) => e && push(e.key, e.model));
  } catch (_) {}
  if (process.env.GEMINI_API_KEY) push(process.env.GEMINI_API_KEY);
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
    const h = keyHealth.get(k.key);
    if (!h) return true;
    if (h.disabled) return false;
    if (h.cooldownUntil && h.cooldownUntil > t) return false;
    return true;
  });
}

function acquireKey(keys, estTokens = 0) {
  const t = now();
  const healthy = healthyKeys(keys);
  if (healthy.length === 0) return null;
  const underBudget = healthy.filter((k) => {
    const h = keyHealth.get(k.key);
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
  const prev = keyHealth.get(key.key) || { failures: 0, cooldownUntil: 0, disabled: false };
  const requests = [...(prev.requests || []).filter((ts) => ts > t - RPM_WINDOW_MS), t];
  const tokens = [...(prev.tokens || []).filter((e) => e.ts > t - RPM_WINDOW_MS), { ts: t, est: estTokens, real: null }];
  keyHealth.set(key.key, { ...prev, requests, tokens });
  return key;
}

function reportSuccess(key, realTokens) {
  const prev = keyHealth.get(key) || { requests: [], tokens: [] };
  const tokens = prev.tokens || [];
  const target = tokens.length ? tokens[tokens.length - 1] : null;
  if (target && target.real == null) target.real = realTokens;
  keyHealth.set(key, { ...prev, failures: 0, cooldownUntil: 0, disabled: false, tokens });
}

function reportFailure(key, status, message) {
  const prev = keyHealth.get(key) || { failures: 0, cooldownUntil: 0, disabled: false, requests: [], tokens: [] };
  const msg = String(message || "").toLowerCase();
  if (status === 401 || status === 403 || /invalid.*api key|api key.*invalid|unauthorized|not found for api version|no longer available/i.test(msg)) {
    // 404 "model not found/retired" on this key → disable it for the session
    keyHealth.set(key, { ...prev, disabled: true });
    return;
  }
  const isRate = status === 429 || /rate.?limit|quota|resource has been exhausted/i.test(msg);
  const base = isRate ? 5_000 : COOLDOWN_BASE_MS;
  const cooldown = Math.min(COOLDOWN_MAX_MS, base * Math.pow(2, Math.min(prev.failures, 5)));
  keyHealth.set(key, { ...prev, failures: prev.failures + 1, cooldownUntil: now() + cooldown });
}

// Convert groq-style { messages, max_tokens, temperature } params to a Gemini
// REST request body.
function toGeminiBody(params) {
  const contents = [];
  let system = "";
  for (const m of params.messages || []) {
    const text = typeof m?.content === "string" ? m.content : (m?.content || []).map((c) => c?.text || "").join("");
    if (m?.role === "system") system += (system ? "\n\n" : "") + text;
    else contents.push({ role: m?.role === "assistant" ? "model" : "user", parts: [{ text }] });
  }
  const body = {
    contents,
    generationConfig: {
      temperature: params.temperature ?? 0.3,
      maxOutputTokens: Math.min(Number(params.max_tokens) || 2000, 64_000),
      // Bulk copywriting = no reasoning needed; thinking mode adds ~10-15s/call
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  return body;
}

function parseGeminiError(status, data) {
  const msg = data?.error?.message || data?.error?.status || `HTTP ${status}`;
  const kind =
    status === 429 || /rate.?limit|quota|resource has been exhausted/i.test(msg)
      ? "rate"
      : status === 401 || status === 403 || status === 404 || /no longer available|not found for api version/i.test(msg)
        ? "invalid"
        : status >= 500
          ? "server"
          : "other";
  const err = new Error(`${status} ${msg}`);
  err.status = status;
  err.kind = kind;
  return err;
}

async function geminiGenerate(key, model, body) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw parseGeminiError(res.status, data);
  return data;
}

/**
 * Same contract as groqKeyPool.chatWithRetry. For JSON tasks (parse provided)
 * we enable Gemini's native JSON mode so parse failures are rare.
 */
async function chatWithRetry(task, params, { parse, budget } = {}) {
  const keys = await getKeys();
  if (keys.length === 0) throw new Error("No Gemini API keys configured.");
  const body = toGeminiBody(params);
  if (parse) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = undefined; // free-form JSON unless task-specific
  }
  let estTokens = 0;
  for (const m of body.contents) estTokens += Math.ceil((m.parts[0]?.text || "").length / 4);
  estTokens += (body.systemInstruction?.parts?.[0]?.text || "").length / 4;
  estTokens += Number(params.max_tokens) || 2000;
  estTokens = Math.round(estTokens);

  const deadline = now() + (budget ?? RETRY_BUDGET_MS);
  let lastErr = null;

  while (now() < deadline) {
    const key = acquireKey(keys, estTokens);
    if (!key) {
      await sleep(1200);
      continue;
    }
    try {
      const data = await geminiGenerate(key.key, key.model, body);
      const realTokens = data.usageMetadata?.totalTokenCount || estTokens;
      const content = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      if (!content) {
        const blocked = data.promptFeedback?.blockReason;
        const err = new Error(blocked ? `Blocked: ${blocked}` : "Empty Gemini response");
        err.status = 422;
        err.kind = "other";
        throw err;
      }
      if (!parse) {
        reportSuccess(key.key, realTokens);
        return content;
      }
      try {
        const parsed = parse(content);
        reportSuccess(key.key, realTokens);
        return parsed;
      } catch (parseErr) {
        reportSuccess(key.key, realTokens);
        lastErr = parseErr;
        continue;
      }
    } catch (err) {
      lastErr = err;
      const kind = err?.kind || "other";
      const status = err?.status || 0;
      if (kind === "invalid" || kind === "rate" || kind === "server") {
        if (kind === "rate") throttles++;
        reportFailure(key.key, status, err.message);
        await sleep(600 + Math.floor(Math.random() * 500));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error(`Gemini request failed after retries (task: ${task}).`);
}

function summary() {
  const keys = cache.keys;
  const t = now();
  let healthy = 0;
  let cooling = 0;
  let disabled = 0;
  for (const k of keys) {
    const h = keyHealth.get(k.key);
    if (!h || (h.cooldownUntil <= t && !h.disabled)) healthy++;
    else if (h.disabled) disabled++;
    else if (h.cooldownUntil > t) cooling++;
  }
  return { total: keys.length, healthy, cooling, disabled, throttles, model: GEMINI_MODEL };
}

module.exports = { getKeys, hasKeys, healthyCount, chatWithRetry, summary };
