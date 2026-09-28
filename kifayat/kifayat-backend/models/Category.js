const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    productCount: { type: Number, default: 0 },
    image: { type: String, default: "" },
  },
  { timestamps: true },
);

const generateSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

categorySchema.pre("save", async function () {
  if (this.isModified("name")) {
    this.slug = generateSlug(this.name);
  }
});

categorySchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();
  if (update.name) {
    this.set({ slug: generateSlug(update.name) });
  }
});

// Collision-safe category creation: names like "Men's Shoes" and "Mens Shoes"
// both normalize to slug "men-shoes", so the insert is retried with a numeric
// suffix when the unique slug index rejects it.
categorySchema.statics.findOrCreateCategory = async function (name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;

  const baseSlug = generateSlug(trimmed);
  if (!baseSlug) return null;

  const existing = await this.findOne({ name: trimmed });
  if (existing) return existing;

  for (let suffix = 0; suffix <= 99; suffix++) {
    const candidateSlug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    try {
      return await this.findOneAndUpdate(
        { name: trimmed },
        { $setOnInsert: { name: trimmed, slug: candidateSlug } },
        { upsert: true, returnDocument: "after" },
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
      // Slug (or name) collision — retry with the next suffix.
    }
  }
  return this.findOne({ name: trimmed });
};

module.exports = mongoose.model("Category", categorySchema);
module.exports.generateSlug = generateSlug;
