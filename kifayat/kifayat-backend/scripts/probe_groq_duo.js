// DECISIVE: are Groq rate limits per-key or org-shared?
// 2 keys each do 6 sequential long calls (~1200 tok) SIMULTANEOUSLY.
// - Both reach ~5-6 ok calls → limits are PER-KEY → more keys = linear scaling.
// - Combined wall ≈ 5-6 calls total → limits are ORG-SHARED → more keys pointless.
require("dotenv").config();
const mongoose = require("mongoose");
const Groq = require("groq-sdk");
const pool = require("../utils/groqKeyPool");

const MODEL = "llama-3.1-8b-instant";
const LONG = "List 20 complete sentences about Pakistani winter weather, each on its own numbered line. Vary the wording, include temperature and clothing details.";
const CALLS = 6;

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
      out.push(`ok #${i} +${((Date.now() - c0) / 1000).toFixed(1)}s tok=${rsp.usage?.completion_tokens || "?"}`);
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
  const [ra, rb] = await Promise.all([seq(keys[0], "key-A"), seq(keys[1], "key-B")]);
  console.log(`== ${ra.label} (${ra.secs}s):`);
  ra.out.forEach((l) => console.log("   " + l));
  console.log(`== ${rb.label} (${rb.secs}s):`);
  rb.out.forEach((l) => console.log("   " + l));
  const aOk = ra.out.filter((l) => l.startsWith("ok")).length;
  const bOk = rb.out.filter((l) => l.startsWith("ok")).length;
  console.log(`\nVERDICT: ${aOk} + ${bOk} = ${aOk + bOk} total ok calls (per-key would allow ${CALLS * 2})`);
  console.log(aOk + bOk >= 8 ? "→ PER-KEY limits confirmed — more keys scale linearly." : "→ ORG-SHARED limits — more keys won't speed up this model.");
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
