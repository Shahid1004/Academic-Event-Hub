const mongoose = require("mongoose");

const passwordResetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5
  },
  lastRequestedAt: Date,
  requestCount: {
    type: Number,
    default: 1
  },
  resetTokenHash: String,
  verifiedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("PasswordReset", passwordResetSchema);