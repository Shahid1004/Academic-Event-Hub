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
  passwordChangedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);