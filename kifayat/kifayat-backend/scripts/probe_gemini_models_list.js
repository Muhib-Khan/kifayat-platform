// List models available to each Gemini key (free-tier keys differ a lot).
require("dotenv").config();
const mongoose = require("mongoose");
const Settings = require("../models/Settings");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const s = await Settings.findOne({}).select("geminiApiKeys").lean();
  const keys = (s.geminiApiKeys || []).map((e) => e.key);
  for (const [ki, key] of keys.entries()) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(60_000) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(`key${ki + 1}: HTTP ${res.status} ${(data?.error?.message || "").slice(0, 120)}`);
      continue;
    }
    const usable = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace("models/", ""));
    console.log(`key${ki + 1} supports: ${usable.join(", ")}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
