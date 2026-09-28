// Find max reliable batch size for Gemini lite models (2 keys only → bigger
// batches = higher throughput; latency is ~6s/call regardless of size).
require("dotenv").config();
const mongoose = require("mongoose");
const Settings = require("../models/Settings");

const combos = [
  { key: 0, model: "gemini-2.5-flash-lite" },
  { key: 1, model: "gemini-3.1-flash-lite" },
];
const SIZES = [48, 96, 144, 192];

function buildBody(size) {
  const products = Array.from({ length: size }, (_, k) => ({
    name: `Wireless Bluetooth Earbuds TWS Pro ANC (sku-${k})`,
  }));
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Write descriptions for ${products.length} products:\n${products.map((p, i) => `${i + 1}. NAME: ${p.name}`).join("\n")}\nReturn JSON array with exactly ${products.length} objects, each {"description":"..."}.`,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: "You are a product copywriter for Kifayat, a Pakistani e-commerce store. Write a concise 30-70 word description per product. Natural English, no prices. Return ONLY a valid JSON array: [{\"description\":\"...\"}] in the same order." }],
    },
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 64_000,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
    },
  };
}

async function callOne(key, model, size) {
  const t0 = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody(size)), signal: AbortSignal.timeout(180_000) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return `HTTP ${res.status}: ${(data?.error?.message || "").slice(0, 120)}`;
  const usage = data.usageMetadata;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed = null;
  let parseErr = "";
  try { parsed = JSON.parse(text); } catch (e) { parseErr = e.message.slice(0, 60); }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const rate = parsed?.length ? Math.round(parsed.length / (secs / 60)) : 0;
  return `OK ${secs}s | out=${usage?.candidatesTokenCount} | len=${parsed?.length ?? "?"}/${size} ${parseErr ? `PARSE: ${parseErr}` : `→ ${rate} products/min (single key)`}`;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const s = await Settings.findOne({}).select("geminiApiKeys").lean();
  const keys = (s.geminiApiKeys || []).map((e) => e.key);
  for (const combo of combos) {
    for (const size of SIZES) {
      try {
        console.log(`key${combo.key + 1} ${combo.model} size ${size}: ${await callOne(keys[combo.key], combo.model, size)}`);
      } catch (e) {
        console.log(`key${combo.key + 1} ${combo.model} size ${size}: EXCEPTION ${e.message?.slice(0, 120)}`);
      }
    }
  }
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
