// Auto-detect the best working model per Gemini key (free-tier accounts vary).
// Tries gemini-2.5-flash-lite first, then gemini-3.1-flash-lite; stores the
// winner on the Settings entry so the pool uses it. Dead keys get model "dead".
require("dotenv").config();
const mongoose = require("mongoose");
const Settings = require("../models/Settings");

const CANDIDATES = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"];

async function probe(key, model) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with exactly the word: OK" }] }],
        generationConfig: { maxOutputTokens: 20, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return `HTTP ${res.status}: ${(data?.error?.message || "").slice(0, 90)}`;
  }
  const data = await res.json().catch(() => ({}));
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.includes("OK") ? "OK" : "BAD:" + text.slice(0, 40);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const s = await Settings.findOne({});
  if (!s) throw new Error("No settings doc");
  const entries = s.geminiApiKeys || [];
  console.log(`${entries.length} Gemini key(s) to check`);

  for (const e of entries) {
    let winner = "dead";
    for (const model of CANDIDATES) {
      const result = await probe(e.key, model);
      console.log(`  ${e.key.slice(0, 12)}… ${model}: ${result}`);
      if (result === "OK") {
        winner = model;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (winner === "dead") console.log(`  → ${e.key.slice(0, 12)}… DEAD (no working model)`);
    e.model = winner;
  }
  await s.save();
  console.log("Models saved per key.");
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
