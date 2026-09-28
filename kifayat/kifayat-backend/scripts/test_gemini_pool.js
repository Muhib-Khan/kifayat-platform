// Smoke test: Gemini pool — parallel description batches through the router.
require("dotenv").config();
const mongoose = require("mongoose");
const pool = require("../utils/groqKeyPool");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  await pool.getKeys();
  console.log("groq pool:", JSON.stringify(pool.summary()));

  const gemini = require("../utils/geminiPool");
  console.log("gemini pool:", JSON.stringify(gemini.summary()));

  const t0 = Date.now();
  const tasks = [];
  for (let i = 0; i < 8; i++) {
    tasks.push(pool.chatWithRetry("descriptions", {
      messages: [
        { role: "system", content: "Write a concise 30-70 word description per product. Return ONLY a JSON array of {\"description\":\"...\"} in the same order." },
        { role: "user", content: `Write descriptions for 3 products:\n1. NAME: Wireless bluetooth earbuds (batch ${i})\n2. NAME: Men's leather wallet\n3. NAME: Air fryer 5L\nReturn JSON array with exactly 3 objects.` },
      ],
      temperature: 0.35,
      max_tokens: 400,
    }, {
      parse: (raw) => {
        const m = raw.match(/\[[\s\S]*\]/);
        if (!m) throw new Error("non-json");
        return JSON.parse(m[0]);
      },
      budget: 120_000,
    }));
  }
  const results = await Promise.allSettled(tasks);
  const ok = results.filter((r) => r.status === "fulfilled" && Array.isArray(r.value) && r.value.length === 3);
  console.log(`${ok.length}/8 batches OK in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  if (ok[0]) console.log("sample:", JSON.stringify(ok[0].value).slice(0, 200));
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
