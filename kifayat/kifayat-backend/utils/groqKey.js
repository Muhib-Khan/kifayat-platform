/**
 * Resolves the active Groq API key.
 *
 * Priority per task:
 *   1. Key in groqApiKeys[] that matches `task`
 *   2. Key in groqApiKeys[] designated "default"
 *   3. First key in groqApiKeys[] (any task)
 *   4. Legacy single groqApiKey field
 *   5. GROQ_API_KEY env var
 */
const Settings = require("../models/Settings");

async function getGroqApiKey(task = "default") {
  try {
    const s = await Settings.findOne({}).select("groqApiKey groqApiKeys").lean();
    const keys = s?.groqApiKeys || [];

    if (keys.length > 0) {
      // 1. Exact task match
      const taskMatch = keys.find((k) => k.task === task && k.key);
      if (taskMatch) return taskMatch.key;

      // 2. "default" fallback
      const def = keys.find((k) => k.task === "default" && k.key);
      if (def) return def.key;

      // 3. First available key
      const first = keys.find((k) => k.key);
      if (first) return first.key;
    }

    // 4. Legacy field
    if (s?.groqApiKey) return s.groqApiKey;
  } catch (_) {
    // DB unavailable — fall through
  }
  return process.env.GROQ_API_KEY || null;
}

module.exports = { getGroqApiKey };
