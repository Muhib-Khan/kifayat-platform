// Find which models key2 actually supports (flash-lite 404'd on it).
require("dotenv").config();
const mongoose = require("mongoose");
const Settings = require("../models/Settings");

const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-preview-05-20",
  "gemini-1.5-flash",
  "gemini-2.5-flash-lite-06-25",
  "gemini-3-flash",
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const s = await Settings.findOne({}).select("geminiApiKeys").lean();
  const key = s.geminiApiKeys[1].key;
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with exactly the word: OK" }] }],
          generationConfig: { maxOutputTokens: 20, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(60_000),
      }
    );
    const data = await res.json().catch(() => ({}));
    const msg = res.ok
      ? (data.candidates?.[0]?.content?.parts?.[0]?.text || "OK (no text)").slice(0, 60)
      : `HTTP ${res.status}: ${(data?.error?.message || "").slice(0, 110)}`;
    console.log(`${model}: ${msg}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
