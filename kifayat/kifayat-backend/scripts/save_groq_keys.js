// Store a "golden" bunch of Groq API keys into Settings (merged, deduped).
// Usage: node scripts/save_groq_keys.js
// Keys are supplied at runtime as a comma-separated list in the GROQ_GOLDEN_KEYS
// environment variable so real API keys are never committed to the repository.
require("dotenv").config();
const mongoose = require("mongoose");
const Settings = require("../models/Settings");

const GOLDEN_KEYS = (process.env.GROQ_GOLDEN_KEYS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  let s = await Settings.findOne({});
  if (!s) s = await Settings.create({});

  const existingKeys = new Set((s.groqApiKeys || []).map((e) => e.key).filter(Boolean));
  const added = [];
  for (const key of GOLDEN_KEYS) {
    if (!existingKeys.has(key)) {
      s.groqApiKeys.push({
        label: `Golden Key ${s.groqApiKeys.length + 1}`,
        task: "default",
        key,
      });
      added.push(key.slice(0, 12) + "…");
    }
  }
  if (added.length) await s.save();
  console.log(`Added ${added.length} new key(s): ${added.join(", ") || "none"}`);
  console.log(`Total keys in Settings: ${s.groqApiKeys.length}`);
  await mongoose.disconnect();
})()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  });
