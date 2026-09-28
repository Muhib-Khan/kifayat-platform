const mongoose = require("mongoose");

const registerUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    firebaseUID: {
      type: String,
      required: [true, "Firebase UID is required"],
      unique: true,
    },
    authProvider: {
      type: String,
      enum: ["email", "google", "manual"],
      required: [true, "Auth provider is required"],
    },
    jwtToken: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "RegisterUserData",
  }
);

registerUserSchema.methods.toSafeObject = function () {
  const user = this.toObject();
  delete user.jwtToken;
  delete user.__v;
  return user;
};

module.exports = mongoose.model("RegisterUserData", registerUserSchema);
