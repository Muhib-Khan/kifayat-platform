const mongoose = require("mongoose");

const deletedUserSchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    gender: { type: String, default: "" },
    phone: { type: String, default: "" },
    authProvider: { type: String, default: "" },
    firebaseUID: { type: String, default: "" },
    role: { type: String, default: "user" },
    isVerified: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: { type: String, default: "" },
  },
  { timestamps: true, collection: "deleted_users" },
);

module.exports = mongoose.model("DeletedUser", deletedUserSchema);
