const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  employeeId: { type: String, trim: true },
  phone: { type: String, trim: true },
  designation: { type: String, trim: true },
  avatarColor: { type: String, trim: true, default: "indigo" },
  preferences: {
    theme: {
      mode: { type: String, enum: ["light", "dark"], default: "light" },
      contrast: { type: String, enum: ["normal", "high"], default: "normal" },
      accent: { type: String, enum: ["indigo", "blue", "teal", "rose"], default: "indigo" }
    }
  },
  role: {
    type: String,
    enum: ["admin", "hod", "coordinator", "faculty"],
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved",
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  approvedAt: Date,
  accessExpiresAt: Date,
  passwordChangedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);