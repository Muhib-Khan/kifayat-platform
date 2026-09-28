// Ground-truth probe: what EXACTLY throttles a key on llama-3.1-8b-instant?
// A) one key, sequential long-generation calls (each ~700-900 real output
//    tokens) until 429 → true per-key TPM.
// B) two keys running the SAME sequence simultaneously → if combined wall ≈
//    single-key wall, limits are ORG-SHARED (more keys won't help).
require("dotenv").config();
const mongoose = require("mongoose");
const Groq = require("groq-sdk");
const pool = require("../utils/groqKeyPool");

const MODEL = "llama-3.1-8b-instant";
const LONG = "Repeat the following sentence, numbered, 60 times. Sentences must be complete and varied: 'The quick brown fox jumps over the lazy dog near the river bank while a curious cat watches from the fence.'";
const CALLS = 10;

async function seq(key, label) {
  const groq = new Groq({ apiKey: key });
  const out = [];
  const t0 = Date.now();
  for (let i = 0; i < CALLS; i++) {
    const c0 = Date.now();
    try {
      const rsp = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: LONG }],
        max_tokens: 1200,
        temperature: 0.7,
      });
      const used = rsp.usage?.completion_tokens || "?";
      out.push(`ok #${i} +${((Date.now() - c0) / 1000).toFixed(1)}s tok=${used}`);
    } catch (err) {
      out.push(`429 #${i} +${((Date.now() - c0) / 1000).toFixed(1)}s ${(err.message || "").slice(0, 60)}`);
      return { label, out, secs: ((Date.now() - t0) / 1000).toFixed(1) };
    }
  }
  return { label, out, secs: ((Date.now() - t0) / 1000).toFixed(1) };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const keys = await pool.getKeys();

  const solo = await seq(keys[0], "SOLO key");
  console.log(`== ${solo.label} (${solo.secs}s):`);
  solo.out.forEach((l) => console.log("   " + l));

  const a = seq(keys[0], "DUO key-A");
  const b = seq(keys[1], "DUO key-B");
  const [ra, rb] = await Promise.all([a, b]);
  console.log(`== ${ra.label} (${ra.secs}s):`);
  ra.out.forEach((l) => console.log("   " + l));
  console.log(`== ${rb.label} (${rb.secs}s):`);
  rb.out.forEach((l) => console.log("   " + l));
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
