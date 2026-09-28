const mongoose = require("mongoose");

const groqKeyEntrySchema = new mongoose.Schema({
  label: { type: String, default: "API Key" },
  task:  {
    type: String,
    enum: ["default","descriptions","titles","reviews","duplicates","seo","pricing","categories"],
    default: "default",
  },
  key: { type: String, required: true },
}, { _id: true });

const geminiKeyEntrySchema = new mongoose.Schema({
  label: { type: String, default: "Gemini Key" },
  key: { type: String, required: true },
  model: { type: String, default: null }, // auto-detected: flash-lite vs 3.1-flash-lite
}, { _id: true });

const settingsSchema = new mongoose.Schema(
  {
    periodNumber:    { type: Number, default: 1 },
    periodStart:     { type: Date,   default: null },
    periodEnd:       { type: Date,   default: null },
    salesSnapshot:   { type: mongoose.Schema.Types.Mixed, default: {} },
    categoryPricing: { type: Map, of: Number, default: {} },
    globalPricing:   { type: Number, default: null },
    // Legacy single-key field (kept for backwards compat)
    groqApiKey:  { type: String, default: null },
    // New: array of task-designated keys
    groqApiKeys: { type: [groqKeyEntrySchema], default: [] },
    // Gemini keys — huge per-key token budgets (e.g. 250k TPM)
    geminiApiKeys: { type: [geminiKeyEntrySchema], default: [] },
    // HHC bearer token — entered once, reused by pagination + dynamic sync
    hhcToken: { type: String, default: "" },
    // Sequential custom order-ID counter for the Main Order CSV export.
    // Incremented once per product line assigned a KO-XXXXXXXX id at download
    // time, so consecutive exports continue from the last assigned id.
    mainCSVCustomOrderId: { type: Number, default: 0 },
    // Flat delivery fee charged on every order (admin-editable; storefront
    // reads it via GET /api/settings/public)
    deliveryFee: { type: Number, default: 100, min: 0 },
    // Landing-page "Objects Considered" hero diptych — product _ids chosen by
    // the admin via Product Hunting; storefront reads via GET /api/settings/public
    heroObjects: {
      type: {
        left:  { type: String, default: null },
        right: { type: String, default: null },
      },
      default: {},
    },
  },
  { timestamps: true, collection: "settings" }
);

module.exports = mongoose.model("Settings", settingsSchema);
