// Store Gemini API key(s) into Settings (merged, deduped).
// Usage: node scripts/save_gemini_key.js
// Keys are supplied at runtime as a comma-separated list in the
// GEMINI_GOLDEN_KEYS environment variable so real API keys are never
// committed to the repository.
require("dotenv").config();
const mongoose = require("mongoose");
const Settings = require("../models/Settings");

const GEMINI_KEYS = (process.env.GEMINI_GOLDEN_KEYS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  let s = await Settings.findOne({});
  if (!s) s = await Settings.create({});

  const existing = new Set((s.geminiApiKeys || []).map((e) => e.key).filter(Boolean));
  const added = [];
  for (const key of GEMINI_KEYS) {
    if (!existing.has(key)) {
      s.geminiApiKeys.push({ label: `Gemini Key ${s.geminiApiKeys.length + 1}`, key });
      added.push(key.slice(0, 12) + "…");
    }
  }
  if (added.length) await s.save();
  console.log(`Added ${added.length} new Gemini key(s): ${added.join(", ") || "none"}`);
  console.log(`Total Gemini keys in Settings: ${s.geminiApiKeys.length}`);
  await mongoose.disconnect();
})()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  });
