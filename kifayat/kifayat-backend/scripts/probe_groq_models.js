// Probe candidate fast models on ONE key to find the one with the highest
// per-key token headroom (the real bottleneck is TPM per key, not RPM).
require("dotenv").config();
const mongoose = require("mongoose");
const Groq = require("groq-sdk");
const pool = require("../utils/groqKeyPool");

const CANDIDATES = [
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
];

const CALLS = 8;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const keys = await pool.getKeys();
  const key = keys[0];
  console.log(`probing with key ${key.slice(0, 14)}…`);

  for (const model of CANDIDATES) {
    const groq = new Groq({ apiKey: key });
    const t0 = Date.now();
    let ok = 0;
    let throttled = 0;
    for (let i = 0; i < CALLS; i++) {
      try {
        await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: "Write a 40-60 word product description. Plain text only." },
            { role: "user", content: `Product ${i}: Wireless Bluetooth Earbuds TWS with charging case` },
          ],
          temperature: 0.3,
          max_tokens: 400,
        });
        ok++;
      } catch (err) {
        const status = err?.status || 0;
        throttled += status === 429 ? 1 : 0;
        console.log(`  ${model} call ${i}: status ${status} ${(err.message || "").slice(0, 70)}`);
      }
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`== ${model}: ${ok}/${CALLS} ok, ${throttled} throttled in ${secs}s — ${(ok / Math.max(secs, 0.001) * 60).toFixed(0)} calls/min`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
