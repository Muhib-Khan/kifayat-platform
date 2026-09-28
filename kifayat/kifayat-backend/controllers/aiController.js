/**
 * AI Automations controller — all endpoints are admin-only.
 *
 * Background jobs  (persist state, can be polled):
 *   1. Description Doctor  — fill thin/missing product descriptions
 *   2. Title Optimizer     — fix bad Daraz-style product titles
 *   5. SEO Booster         — generate search keywords per product
 *   7. Category Fixer      — correct miscategorised products
 *
 * One-shot tools  (return data immediately):
 *   3. Review Intelligence — sentiment analysis across all reviews
 *   4. Duplicate Radar     — surface near-identical products
 *   6. Price Intelligence  — pricing strategy analysis
 */

const Product       = require("../models/Product");
const Review        = require("../models/Review");
const WebsiteReview = require("../models/WebsiteReview");
const groqKeyPool   = require("../utils/groqKeyPool");
const geminiPool    = require("../utils/geminiPool");
const { GROQ_MODEL } = require("../utils/groqProductOptimizer");

const CATEGORIES = ["Electronics", "Fashion", "Home & Kitchen", "Beauty", "Sports", "Toys"];

// ─── Shared helpers ───────────────────────────────────────────────────────────
function makeJobState() {
  return { running: false, done: false, error: null, processed: 0, total: 0, updated: 0, logs: [] };
}

async function ensureGroq(res) {
  if (!(await groqKeyPool.hasKeys())) {
    res.status(500).json({ success: false, message: "Groq API keys not configured. Add them in Admin → Settings." });
    return false;
  }
  return true;
}

// More keys in the pool = more parallel batches per AI Studio job
async function batchConcurrency() {
  return Math.max(4, Math.min(32, await groqKeyPool.healthyCount()));
}

// Big-first-wave batching: the FIRST `concurrency` batches are BIG so every
// key drains its empty 60s token window in ONE call (the initial burst), then
// the remainder flows at the per-key wall speed in normal-sized batches.
//   concurrency ≈ number of parallel lanes; BIG sized to ~fill a token window:
//   descriptions ~48 (110 tok ea), titles ~100, seo ~80, categories ~150.
function buildBatches(products, BATCH, concurrency, BIG) {
  const batches = [];
  let i = 0;
  for (; i < products.length && batches.length < concurrency; i += BIG) {
    batches.push(products.slice(i, i + BIG));
  }
  for (; i < products.length; i += BATCH) {
    batches.push(products.slice(i, i + BATCH));
  }
  return batches;
}

// Shared JSON-array parse for the background jobs
const parseJsonArray = (raw) => {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Non-JSON response");
  return JSON.parse(match[0]);
};

function addLog(state, type, message, extra = {}) {
  const entry = { type, message, time: new Date().toLocaleTimeString(), ...extra };
  state.logs.push(entry);
  if (state.logs.length > 600) state.logs.shift();
  return entry;
}

// ─── 1. DESCRIPTION DOCTOR ────────────────────────────────────────────────────
const descState = makeJobState();
const getDescriptionDoctorStatus = (req, res) => res.json({ success: true, state: descState });

const startDescriptionDoctor = async (req, res) => {
  if (descState.running) return res.status(409).json({ success: false, message: "Already running." });
  if (!(await ensureGroq(res))) return;

  Object.assign(descState, makeJobState());
  descState.running = true;
  res.json({ success: true, message: "Description Doctor started." });

  (async () => {
    try {
      const products = await Product.find({
        $or: [
          { description: { $exists: false } },
          { description: "" },
          { description: { $regex: /^[\s\S]{0,35}$/ } },
        ],
      }).select("_id name description category").lean();

      descState.total = products.length;
      addLog(descState, "info", `Found ${products.length} products with thin or missing descriptions.`);
      if (products.length === 0) {
        descState.running = false; descState.done = true;
        addLog(descState, "done", "All products already have descriptions — nothing to fix!");
        return;
      }

      const BATCH = 12;
      const CONCURRENCY = await batchConcurrency();
      const batches = buildBatches(products, BATCH, CONCURRENCY, 24);

      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk = batches.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (batch) => {
            try {
              const lines = batch.map((p, idx) => `${idx + 1}. NAME: ${p.name}\nCATEGORY: ${p.category}`).join("\n\n");
              const parsed = await groqKeyPool.chatWithRetry("descriptions", {
                model: GROQ_MODEL,
                messages: [
                  { role: "system", content: `You are a product copywriter for Kifayat, a Pakistani e-commerce store. Write a concise, helpful description for each product.\nRules: 30–70 words. Focus on what the product is and its uses. Natural English, no emojis, no prices, no invented specs.\nReturn ONLY a valid JSON array: [{"description":"..."}] in the same order as the input.` },
                  { role: "user", content: `Write descriptions for these ${batch.length} products:\n\n${lines}\n\nReturn JSON array with exactly ${batch.length} objects.` },
                ],
                temperature: 0.35, max_tokens: batch.length * 110,
              }, {
                parse: parseJsonArray,
                budget: 300_000,
                split: (p) => groqKeyPool.splitBatchParams(p, batch, (sub) =>
                  `Write descriptions for these ${sub.length} products:\n\n${sub.map((x, i) => `${i + 1}. NAME: ${x.name}\nCATEGORY: ${x.category}`).join("\n\n")}\n\nReturn JSON array with exactly ${sub.length} objects.`),
              });

              const bulkOps = batch.map((p, idx) => {
                const desc = parsed[idx]?.description?.trim();
                if (!desc) return null;
                return { updateOne: { filter: { _id: p._id }, update: { $set: { description: desc } } } };
              }).filter(Boolean);

              if (bulkOps.length) await Product.bulkWrite(bulkOps);
              descState.updated   += bulkOps.length;
              descState.processed += batch.length;
              const pct = Math.round((descState.processed / descState.total) * 100);
              addLog(descState, "progress", `${descState.processed}/${descState.total} (${pct}%) — ${descState.updated} descriptions written`, { processed: descState.processed, total: descState.total, pct });
            } catch (err) {
              descState.processed += batch.length;
              addLog(descState, "warn", `Batch failed: ${(err.message || "").slice(0, 80)}`);
            }
          })
        );
      }
      descState.running = false; descState.done = true;
      addLog(descState, "done", `Done! ${descState.updated} descriptions generated across ${descState.total} products.`);
    } catch (err) {
      descState.running = false; descState.error = err.message;
      addLog(descState, "error", err.message);
    }
  })();
};

// ─── 2. TITLE OPTIMIZER ───────────────────────────────────────────────────────
const titleState = makeJobState();
const getTitleOptimizerStatus = (req, res) => res.json({ success: true, state: titleState });

const startTitleOptimizer = async (req, res) => {
  if (titleState.running) return res.status(409).json({ success: false, message: "Already running." });
  if (!(await ensureGroq(res))) return;

  Object.assign(titleState, makeJobState());
  titleState.running = true;
  res.json({ success: true, message: "Title Optimizer started." });

  (async () => {
    try {
      const all = await Product.find({}).select("_id name category").lean();
      const poor = all.filter((p) => {
        const n = p.name || "";
        return (n.length > 120 || (n === n.toUpperCase() && n.replace(/\s/g, "").length > 6) ||
          /^[A-Z0-9\-_.]{4,}\s/i.test(n) || n.length < 8 || /[_|]{2,}/.test(n) || /\d{6,}/.test(n));
      });

      titleState.total = poor.length;
      addLog(titleState, "info", `Found ${poor.length} products with titles that need improvement.`);
      if (poor.length === 0) {
        titleState.running = false; titleState.done = true;
        addLog(titleState, "done", "All product titles look great — nothing to fix!"); return;
      }

      const BATCH = 12;
      const CONCURRENCY = await batchConcurrency();
      const batches = buildBatches(poor, BATCH, CONCURRENCY, 60);

      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk = batches.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (batch) => {
            try {
              const lines = batch.map((p, idx) => `${idx + 1}. CURRENT: "${p.name}" | CATEGORY: ${p.category}`).join("\n");
              const parsed = await groqKeyPool.chatWithRetry("titles", {
                model: GROQ_MODEL,
                messages: [
                  { role: "system", content: `You are a Daraz/Amazon marketplace listing specialist for a Pakistani e-commerce store. Rewrite product titles to be clear, searchable, and under 120 characters.\nRules: Title Case. Product type first, then key attributes. Remove supplier codes, model numbers, all-caps, HTML, keyword stuffing. Keep real brand names.\nReturn ONLY a JSON array: [{"name":"..."}] in the same order as the input.` },
                  { role: "user", content: `Optimize these ${batch.length} product titles:\n${lines}\n\nReturn JSON array with exactly ${batch.length} objects.` },
                ],
                temperature: 0.2, max_tokens: batch.length * 65,
              }, {
                parse: parseJsonArray,
                budget: 300_000,
                split: (p) => groqKeyPool.splitBatchParams(p, batch, (sub) =>
                  `Optimize these ${sub.length} product titles:\n${sub.map((x, i) => `${i + 1}. CURRENT: "${x.name}" | CATEGORY: ${x.category}`).join("\n")}\n\nReturn JSON array with exactly ${sub.length} objects.`),
              });

              const bulkOps = batch.map((p, idx) => {
                const newName = parsed[idx]?.name?.trim();
                if (!newName || newName === p.name) return null;
                return { updateOne: { filter: { _id: p._id }, update: { $set: { name: newName } } } };
              }).filter(Boolean);

              if (bulkOps.length) await Product.bulkWrite(bulkOps);
              titleState.updated   += bulkOps.length;
              titleState.processed += batch.length;
              const pct = Math.round((titleState.processed / titleState.total) * 100);
              addLog(titleState, "progress", `${titleState.processed}/${titleState.total} (${pct}%) — ${titleState.updated} titles improved`, { processed: titleState.processed, total: titleState.total, pct });
            } catch (err) {
              titleState.processed += batch.length;
              addLog(titleState, "warn", `Batch failed: ${(err.message || "").slice(0, 80)}`);
            }
          })
        );
      }
      titleState.running = false; titleState.done = true;
      addLog(titleState, "done", `Done! ${titleState.updated} titles improved out of ${titleState.total} candidates.`);
    } catch (err) {
      titleState.running = false; titleState.error = err.message;
      addLog(titleState, "error", err.message);
    }
  })();
};

// ─── 3. REVIEW INTELLIGENCE ───────────────────────────────────────────────────
const analyzeReviews = async (req, res) => {
  try {
    if (!(await ensureGroq(res))) return;

    const [productReviews, siteReviews] = await Promise.all([
      Review.find({}).select("rating comment").lean(),
      WebsiteReview.find({}).select("rating comment").lean(),
    ]);

    const all = [
      ...productReviews.map((r) => ({ rating: r.rating, comment: r.comment })),
      ...siteReviews.map((r) => ({ rating: r.rating, comment: r.comment })),
    ].filter((r) => r.comment && r.comment.trim().length > 3);

    if (all.length === 0) return res.json({ success: true, insights: { total: 0, analyzed: 0, summary: "No reviews to analyze yet." } });

    const sample     = all.length > 150 ? [...all].sort(() => Math.random() - 0.5).slice(0, 150) : all;
    const reviewText = sample.map((r) => `[${r.rating}★] ${r.comment}`).join("\n");

    const rsp = await groqKeyPool.chatWithRetry("reviews", {
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: `You are a business analyst for Kifayat, a Pakistani e-commerce store. Analyze customer reviews and return a JSON object:\n{"averageRating":<1.0–5.0>,"sentiment":"positive"|"mixed"|"negative","topPraises":["..."],"topComplaints":["..."],"actionItems":["..."],"summary":"<2-3 sentences>"}\nReturn ONLY the JSON object.` },
        { role: "user", content: `Analyze these ${sample.length} customer reviews:\n\n${reviewText}` },
      ],
      temperature: 0.2, max_tokens: 700,
    }, {
      parse: (raw) => {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI returned non-JSON response.");
        return JSON.parse(match[0]);
      },
    });

    const insights       = rsp;
    insights.total        = all.length;
    insights.analyzed     = sample.length;
    insights.productCount = productReviews.length;
    insights.siteCount    = siteReviews.length;
    res.json({ success: true, insights });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 4. DUPLICATE RADAR ───────────────────────────────────────────────────────
const findDuplicates = async (req, res) => {
  try {
    if (!(await ensureGroq(res))) return;

    const products = await Product.find({ hidden: { $ne: true } }).select("_id name category imageUrl retailPrice").limit(500).lean();
    if (products.length < 2) return res.json({ success: true, groups: [], scanned: products.length });

    const lines = products.map((p, i) => `${i + 1}. [${p._id}] ${p.name} (${p.category})`).join("\n");
    const idGroups = await groqKeyPool.chatWithRetry("duplicates", {
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: `You are a data quality analyst for an e-commerce catalog. Identify groups of likely-duplicate or near-identical products.\nReturn ONLY a JSON array of groups. Each group is an array of MongoDB _id strings. Only high-confidence duplicates. Max 20 groups. If none, return [].\nExample: [["id1","id2"],["id3","id4","id5"]]` },
        { role: "user", content: `Find duplicate product groups (${products.length} products):\n\n${lines}\n\nReturn JSON array of duplicate ID groups.` },
      ],
      temperature: 0, max_tokens: 1200,
    }, { parse: parseJsonArray }).catch(() => []);

    if (!Array.isArray(idGroups)) return res.json({ success: true, groups: [], scanned: products.length });

    const lookup = new Map(products.map((p) => [p._id.toString(), p]));
    const groups = idGroups
      .filter((g) => Array.isArray(g) && g.length >= 2)
      .map((g) => g.map((id) => lookup.get(String(id))).filter(Boolean))
      .filter((g) => g.length >= 2);

    res.json({ success: true, groups, scanned: products.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 5. SEO BOOSTER (background job) ─────────────────────────────────────────
const seoState = makeJobState();
const getSeoBoosterStatus = (req, res) => res.json({ success: true, state: seoState });

const startSeoBooster = async (req, res) => {
  if (seoState.running) return res.status(409).json({ success: false, message: "Already running." });
  if (!(await ensureGroq(res))) return;

  Object.assign(seoState, makeJobState());
  seoState.running = true;
  res.json({ success: true, message: "SEO Booster started." });

  (async () => {
    try {
      // Target products without search keywords
      const products = await Product.find({
        $or: [
          { keywords: { $exists: false } },
          { keywords: null },
          { keywords: "" },
          { keywords: { $size: 0 } },
        ],
      }).select("_id name description category").limit(300).lean();

      seoState.total = products.length;
      addLog(seoState, "info", `Found ${products.length} products without search keywords.`);
      if (products.length === 0) {
        seoState.running = false; seoState.done = true;
        addLog(seoState, "done", "All products already have SEO keywords — nothing to do!"); return;
      }

      const BATCH = 10;
      const CONCURRENCY = await batchConcurrency();
      const batches = buildBatches(products, BATCH, CONCURRENCY, 40);

      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk = batches.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (batch) => {
            try {
              const lines = batch.map((p, idx) =>
                `${idx + 1}. NAME: ${p.name} | CATEGORY: ${p.category}${p.description ? ` | DESC: ${p.description.slice(0, 80)}` : ""}`
              ).join("\n");

              const parsed = await groqKeyPool.chatWithRetry("seo", {
                model: GROQ_MODEL,
                messages: [
                  { role: "system", content: `You are an SEO specialist for Kifayat, a Pakistani e-commerce store. Generate 6–10 relevant search keywords for each product.\nKeywords should be: short phrases or single words, highly searchable in Pakistan, covering product type, use case, and buyer intent. No duplicates. No prices. Urdu transliterations welcome where natural.\nReturn ONLY a JSON array: [{"keywords":["kw1","kw2",...]}] in the same order as the input.` },
                  { role: "user", content: `Generate SEO keywords for these ${batch.length} products:\n\n${lines}\n\nReturn JSON array with exactly ${batch.length} objects.` },
                ],
                temperature: 0.3, max_tokens: batch.length * 80,
              }, {
                parse: parseJsonArray,
                budget: 300_000,
                split: (p) => groqKeyPool.splitBatchParams(p, batch, (sub) =>
                  `Generate SEO keywords for these ${sub.length} products:\n\n${sub.map((x, i) =>
                    `${i + 1}. NAME: ${x.name} | CATEGORY: ${x.category}${x.description ? ` | DESC: ${x.description.slice(0, 80)}` : ""}`
                  ).join("\n")}\n\nReturn JSON array with exactly ${sub.length} objects.`),
              });

              const bulkOps = batch.map((p, idx) => {
                const kws = parsed[idx]?.keywords;
                if (!Array.isArray(kws) || kws.length === 0) return null;
                return { updateOne: { filter: { _id: p._id }, update: { $set: { keywords: kws } } } };
              }).filter(Boolean);

              if (bulkOps.length) await Product.bulkWrite(bulkOps);
              seoState.updated   += bulkOps.length;
              seoState.processed += batch.length;
              const pct = Math.round((seoState.processed / seoState.total) * 100);
              addLog(seoState, "progress", `${seoState.processed}/${seoState.total} (${pct}%) — ${seoState.updated} products keyworded`, { processed: seoState.processed, total: seoState.total, pct });
            } catch (err) {
              seoState.processed += batch.length;
              addLog(seoState, "warn", `Batch failed: ${(err.message || "").slice(0, 80)}`);
            }
          })
        );
      }
      seoState.running = false; seoState.done = true;
      addLog(seoState, "done", `Done! ${seoState.updated} products now have SEO keywords.`);
    } catch (err) {
      seoState.running = false; seoState.error = err.message;
      addLog(seoState, "error", err.message);
    }
  })();
};

// ─── 6. PRICE INTELLIGENCE (one-shot) ────────────────────────────────────────
const analyzePricing = async (req, res) => {
  try {
    if (!(await ensureGroq(res))) return;

    const products = await Product.find({ hidden: { $ne: true } })
      .select("_id name category retailPrice salesCount")
      .lean();

    if (products.length < 5) return res.json({ success: true, insights: { summary: "Not enough products to analyze pricing yet." } });

    // Build a compact summary by category
    const byCategory = {};
    for (const p of products) {
      const cat = p.category || "Uncategorised";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({ name: p.name.slice(0, 60), price: p.retailPrice, sales: p.salesCount || 0 });
    }

    const lines = Object.entries(byCategory).map(([cat, items]) => {
      const prices   = items.map((i) => i.price).filter(Boolean);
      const avg      = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
      const min      = Math.min(...prices);
      const max      = Math.max(...prices);
      const topSeller = items.sort((a, b) => b.sales - a.sales)[0];
      return `${cat}: ${items.length} products | avg Rs ${avg} | range Rs ${min}–${max} | top seller: "${topSeller?.name}" (${topSeller?.sales} sales)`;
    }).join("\n");

    const insights = await groqKeyPool.chatWithRetry("pricing", {
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: `You are a pricing strategist for Kifayat, a Pakistani e-commerce store. Analyze the category pricing data and return a JSON object:\n{"overallHealth":"good"|"fair"|"poor","categoryInsights":[{"category":"...","assessment":"...","recommendation":"..."}],"pricingGaps":["..."],"quickWins":["..."],"summary":"<2-3 sentence executive summary>"}\nBe specific, actionable, and tailored to Pakistan's market. Return ONLY the JSON object.` },
        { role: "user", content: `Analyze this pricing data for ${products.length} products:\n\n${lines}\n\nProvide pricing intelligence insights.` },
      ],
      temperature: 0.3, max_tokens: 900,
    }, {
      parse: (raw) => {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI returned non-JSON response.");
        return JSON.parse(match[0]);
      },
    });
    insights.totalProducts = products.length;
    insights.categories    = Object.keys(byCategory).length;
    res.json({ success: true, insights });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 7. CATEGORY FIXER (background job) ──────────────────────────────────────
const categoryState = makeJobState();
const getCategoryFixerStatus = (req, res) => res.json({ success: true, state: categoryState });

const startCategoryFixer = async (req, res) => {
  if (categoryState.running) return res.status(409).json({ success: false, message: "Already running." });
  if (!(await ensureGroq(res))) return;

  Object.assign(categoryState, makeJobState());
  categoryState.running = true;
  res.json({ success: true, message: "Category Fixer started." });

  (async () => {
    try {
      const products = await Product.find({ hidden: { $ne: true } }).select("_id name category").lean();
      categoryState.total = products.length;
      addLog(categoryState, "info", `Scanning ${products.length} products for category mismatches…`);

      const BATCH = 20;
      const CONCURRENCY = await batchConcurrency();
      const batches = buildBatches(products, BATCH, CONCURRENCY, 100);

      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk = batches.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (batch) => {
            try {
              const lines = batch.map((p, idx) => `${idx + 1}. [${p._id}] "${p.name}" → current: "${p.category}"`).join("\n");
              const corrections = await groqKeyPool.chatWithRetry("categories", {
                model: GROQ_MODEL,
                messages: [
                  { role: "system", content: `You are a product catalog manager for a Pakistani e-commerce store. Verify each product is in the correct category from this list: ${CATEGORIES.join(", ")}.\nOnly flag products you are HIGHLY CONFIDENT are miscategorised.\nReturn ONLY a JSON array of corrections: [{"id":"mongodb_id","correctCategory":"..."}] — if everything is fine, return [].` },
                  { role: "user", content: `Check these ${batch.length} products:\n\n${lines}\n\nReturn JSON array of corrections only (empty array if all correct).` },
                ],
                temperature: 0, max_tokens: batch.length * 30,
              }, {
                parse: parseJsonArray,
                budget: 300_000,
                split: (p) => groqKeyPool.splitBatchParams(p, batch, (sub) =>
                  `Check these ${sub.length} products:\n\n${sub.map((x, i) => `${i + 1}. [${x._id}] "${x.name}" → current: "${x.category}"`).join("\n")}\n\nReturn JSON array of corrections only (empty array if all correct).`),
              }).catch(() => []);

              const validCats   = new Set(CATEGORIES.map((c) => c.toLowerCase()));
              const bulkOps     = corrections
                .filter((c) => c.id && c.correctCategory && validCats.has(c.correctCategory.toLowerCase()))
                .map((c) => ({
                  updateOne: {
                    filter: { _id: c.id },
                    update: { $set: { category: c.correctCategory } },
                  },
                }));

              if (bulkOps.length) await Product.bulkWrite(bulkOps);
              categoryState.updated   += bulkOps.length;
              categoryState.processed += batch.length;
              const pct = Math.round((categoryState.processed / categoryState.total) * 100);
              addLog(categoryState, "progress", `${categoryState.processed}/${categoryState.total} (${pct}%) — ${categoryState.updated} recategorised`, { processed: categoryState.processed, total: categoryState.total, pct });
              if (bulkOps.length) addLog(categoryState, "info", `Fixed: ${corrections.map((c) => c.correctCategory).join(", ")}`);
            } catch (err) {
              categoryState.processed += batch.length;
              addLog(categoryState, "warn", `Batch failed: ${(err.message || "").slice(0, 80)}`);
            }
          })
        );
      }
      categoryState.running = false; categoryState.done = true;
      addLog(categoryState, "done", `Done! ${categoryState.updated} products recategorised out of ${categoryState.total} scanned.`);
    } catch (err) {
      categoryState.running = false; categoryState.error = err.message;
      addLog(categoryState, "error", err.message);
    }
  })();
};

// ─── 8. POOL STATUS (engine health) ─────────────────────────────────────────
const maskKey = (k) => (String(k || "").length <= 8 ? "••••" : `${String(k).slice(0, 6)}…${String(k).slice(-4)}`);

const poolStatus = async (req, res) => {
  try {
    const [groqKeys, geminiKeys] = await Promise.all([
      groqKeyPool.getKeys(),
      geminiPool.getKeys(),
    ]);
    res.json({
      success: true,
      groq: {
        ...groqKeyPool.summary(),
        keys: groqKeys.map(maskKey),
      },
      gemini: {
        ...geminiPool.summary(),
        keys: geminiKeys.map((k) => ({ preview: maskKey(k.key), model: k.model })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 9. HIDE PRODUCT (utility) ────────────────────────────────────────────────
const hideProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { $set: { hidden: true } });
    res.json({ success: true, message: "Product hidden." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  startDescriptionDoctor, getDescriptionDoctorStatus,
  startTitleOptimizer,    getTitleOptimizerStatus,
  analyzeReviews,
  findDuplicates,
  startSeoBooster,        getSeoBoosterStatus,
  analyzePricing,
  startCategoryFixer,     getCategoryFixerStatus,
  hideProduct,
  poolStatus,
};

