const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: null, // null for Google users
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Male", "Female", "Other", "Prefer not to say"],
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20,
    },
    avatar: {
      type: String,
      default: "",
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    isVerifiedCustomer: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ["email", "google", "manual"],
      required: true,
    },
    firebaseUID: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null, // SHA-256 hash of the code
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "seller", "admin"],
      default: "user",
    },
    storeName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    storeSlug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    pendingEmail: {
      type: String,
      default: null,
    },
    pendingEmailOTP: {
      type: String,
      default: null,
    },
    pendingEmailOTPExpiry: {
      type: Date,
      default: null,
    },
    pendingPasswordOTP: {
      type: String,
      default: null,
    },
    pendingPasswordOTPExpiry: {
      type: Date,
      default: null,
    },
    pendingNewPassword: {
      type: String,
      default: null,
    },
    orderConEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    orderConEmailVerified: {
      type: Boolean,
      default: false,
    },
    pendingOrderConEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    pendingOrderConEmailOTP: {
      type: String,
      default: null,
    },
    pendingOrderConEmailOTPExpiry: {
      type: Date,
      default: null,
    },
    shipmentEmails: {
      type: [String],
      default: [],
    },

    // ── Loyalty & Tiers ──
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    totalOrdersCount: {
      type: Number,
      default: 0,
    },
    totalSpentAmount: {
      type: Number,
      default: 0,
    },
    customDiscountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    priceMultiplier: {
      type: Number,
      default: 70,
      min: 0,
      max: 100,
    },
    tierAssignedManually: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "SignupUsers",
  }
);

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  delete obj.pendingEmailOTP;
  delete obj.pendingEmailOTPExpiry;
  delete obj.pendingPasswordOTP;
  delete obj.pendingPasswordOTPExpiry;
  delete obj.pendingOrderConEmailOTP;
  delete obj.pendingOrderConEmailOTPExpiry;
  delete obj.newPassword;
  delete obj.pendingNewPassword;
  delete obj.priceMultiplier;
  delete obj.customDiscountPercent;
  delete obj.tierAssignedManually;
  delete obj.firebaseUID;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
