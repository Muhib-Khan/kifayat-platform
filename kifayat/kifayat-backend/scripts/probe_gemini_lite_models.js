// Pick the best working lite model for FREE-tier keys: real 24-product JSON
// call, measures latency/parse/reliability. 2.5-flash is quota-dead on free.
require("dotenv").config();
const mongoose = require("mongoose");
const Settings = require("../models/Settings");

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

const productNames = Array.from({ length: 24 }, (_, k) => ({
  name: `Wireless Bluetooth Earbuds TWS Pro ANC (sku-${k})`,
  category: "Uncategorized",
}));

function buildBody() {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Write descriptions for ${productNames.length} products:\n${productNames.map((p, i) => `${i + 1}. NAME: ${p.name}`).join("\n")}\nReturn JSON array with exactly ${productNames.length} objects, each {"description":"..."}.`,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: "You are a product copywriter for Kifayat, a Pakistani e-commerce store. Write a concise 30-70 word description per product. Natural English, no prices. Return ONLY a valid JSON array: [{\"description\":\"...\"}] in the same order." }],
    },
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 2640,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
    },
  };
}

async function callOne(key, model) {
  const t0 = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody()), signal: AbortSignal.timeout(120_000) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return `HTTP ${res.status}: ${(data?.error?.message || "").slice(0, 150)}`;
  const usage = data.usageMetadata;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed = null;
  let parseErr = "";
  try { parsed = JSON.parse(text); } catch (e) { parseErr = e.message.slice(0, 80); }
  return `OK ${((Date.now() - t0) / 1000).toFixed(1)}s | tok=${usage?.totalTokenCount} out=${usage?.candidatesTokenCount} | len=${parsed?.length ?? "?"} ${parseErr ? `PARSE: ${parseErr}` : ""}`;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const s = await Settings.findOne({}).select("geminiApiKeys").lean();
  const keys = (s.geminiApiKeys || []).map((e) => e.key);
  for (const [ki, key] of keys.entries()) {
    for (const model of MODELS) {
      try {
        console.log(`key${ki + 1} ${model}: ${await callOne(key, model)}`);
      } catch (e) {
        console.log(`key${ki + 1} ${model}: EXCEPTION ${e.message?.slice(0, 150)}`);
      }
    }
  }
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
