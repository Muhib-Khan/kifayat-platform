// Live smoke test for the Groq key pool — run 6 parallel classify calls
// through chatWithRetry, verify rotation + measure throughput.
require("dotenv").config();
const mongoose = require("mongoose");
const pool = require("../utils/groqKeyPool");
const { GROQ_MODEL } = require("../utils/groqProductOptimizer");

const paramsFor = (items) => ({
  model: GROQ_MODEL,
  messages: [
    { role: "system", content: "Classify each product into EXACTLY ONE: Electronics, Fashion, Home & Kitchen, Beauty, Sports, Toys. Return ONLY a JSON array of category strings in the same order." },
    { role: "user", content: `Classify:\n${items.map((n, i) => `${i + 1}. ${n}`).join("\n")}\nReturn JSON array.` },
  ],
  temperature: 0,
  max_tokens: 120,
});

const parse = (raw) => {
  const m = raw.match(/\[[\s\S]*?\]/);
  if (!m) throw new Error("non-json: " + raw.slice(0, 80));
  return JSON.parse(m[0]);
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log("hasKeys:", await pool.hasKeys(), "| healthy:", await pool.healthyCount(), "| summary:", JSON.stringify(pool.summary()));

  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, (_, i) =>
      pool.chatWithRetry("test", paramsFor([`Wireless bluetooth earbuds with charging case (batch ${i})`, "Men's leather wallet brown", "Air fryer 5L digital"]), { parse })
    )
  );
  const ms = Date.now() - t0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`call ${i}: OK ${JSON.stringify(r.value)}`);
    else console.log(`call ${i}: FAIL ${r.reason.message.slice(0, 100)}`);
  });
  console.log(`12 parallel calls in ${ms}ms — pool now: ${JSON.stringify(pool.summary())}`);
  await mongoose.disconnect();
})()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  });
