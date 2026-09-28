// Realistic Description Doctor benchmark — 12-product batches of real
// description generation through the pool (task "descriptions" → fast model).
// Runs a fixed number of batches and reports throughput.
require("dotenv").config();
const mongoose = require("mongoose");
const pool = require("../utils/groqKeyPool");

const PRODUCTS = [
  "Wireless Bluetooth Earbuds TWS with Charging Case", "Men's Leather Wallet Brown",
  "Air Fryer 5L Digital Touch", "Rose Quartz Face Roller", "Cricket Bat Willow",
  "Kids Building Blocks 100pcs", "Perfume Eau De Parfum 50ml", "Laptop Cooling Pad",
  "Yoga Mat Non Slip 6mm", "Hair Dryer Ionic 2000W", "Sunglasses UV400 Polarized",
  "Blender 500W Juicer Combo",
];

const TASK = "descriptions";
const BATCH = 12;
const TARGET_BATCHES = 120; // 1,440 products worth

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  await pool.getKeys(); // populate cache so summary() has real numbers
  console.log("pool:", JSON.stringify(pool.summary()));

  const concurrency = Math.max(4, Math.min(32, await pool.healthyCount()));

  // Big-first-wave batches (matches production buildBatches): first
  // `concurrency` calls are BIG (48 products in ONE API call), the rest 12.
  const BIG = 48; // reliable per-call size: Gemini JSON-mode handles 48, Groq 8b caps ~24
  const sizes = [];
  for (let i = 0; sizes.length < concurrency && sizes.reduce((a, s) => a + s, 0) < TARGET_BATCHES * BATCH; ) {
    sizes.push(BIG);
  }
  let covered = sizes.reduce((a, s) => a + s, 0);
  while (covered < TARGET_BATCHES * BATCH) { sizes.push(BATCH); covered += BATCH; }

  const t0 = Date.now();
  let done = 0;
  let fails = 0;

  async function worker() {
    while (done < sizes.length) {
      const myIndex = done++;
      const size = sizes[myIndex];
      const batch = Array.from({ length: size }, (_, k) => ({
        name: `${PRODUCTS[k % PRODUCTS.length]} (sku-${myIndex}-${k})`,
        category: "Uncategorized",
      }));
      try {
        const parsed = await pool.chatWithRetry(TASK, {
          messages: [
            { role: "system", content: "You are a product copywriter for Kifayat, a Pakistani e-commerce store. Write a concise 30-70 word description per product. Natural English, no prices. Return ONLY a JSON array: [{\"description\":\"...\"}] in the same order." },
            { role: "user", content: `Write descriptions for ${batch.length} products:\n${batch.map((p, i) => `${i + 1}. NAME: ${p.name}`).join("\n")}\nReturn JSON array with exactly ${batch.length} objects.` },
          ],
          temperature: 0.35,
          max_tokens: batch.length * 110,
        }, { parse: (raw) => { const m = raw.match(/\[[\s\S]*\]/); if (!m) throw new Error("non-json"); return JSON.parse(m[0]); }, budget: 300_000 });
        if (!Array.isArray(parsed) || parsed.length !== batch.length) throw new Error("bad length");
      } catch (err) {
        fails++;
        console.log(`call ${myIndex} (size ${size}) FAIL: ${(err.message || "").slice(0, 80)}`);
      }
      const prods = sizes.slice(0, done).reduce((a, s) => a + s, 0);
      if (done % 5 === 0 || prods >= TARGET_BATCHES * BATCH) {
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        const rate = (prods / (secs / 60)).toFixed(0);
        console.log(`  ${prods}/${TARGET_BATCHES * BATCH} products in ${secs}s — ${rate} products/min`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const secs = (Date.now() - t0) / 1000;
  const totalProds = TARGET_BATCHES * BATCH;
  const rate = totalProds / (secs / 60);
  console.log(`\nDONE: ${totalProds} descriptions in ${secs.toFixed(1)}s (${fails} failed) — ${rate.toFixed(0)} products/min`);
  console.log(`Full catalog (8,400 products) at this rate ≈ ${(8400 / rate * 60 / 60).toFixed(1)} minutes`);
  console.log("pool after:", JSON.stringify(pool.summary()));
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });

