const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "default" },
  academicYears: [{
    name: { type: String, required: true, trim: true },
    current: { type: Boolean, default: false }
  }],
  departments: [{
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    hod: { type: String, trim: true },
    strength: { type: Number, default: 0 }
  }],
  eventTypes: [{ type: String, trim: true }],
  documentCategories: [{ type: String, trim: true }],
  notifications: {
    attendancePending: { type: Boolean, default: true },
    feedbackCompleted: { type: Boolean, default: true },
    paymentPending: { type: Boolean, default: true },
    reportGenerated: { type: Boolean, default: true },
    documentationCompleted: { type: Boolean, default: false },
    upcomingEvent: { type: Boolean, default: true },
    newEventAssigned: { type: Boolean, default: true }
  },
  theme: {
    mode: { type: String, enum: ["light", "dark"], default: "light" },
    contrast: { type: String, enum: ["normal", "high"], default: "normal" },
    accent: { type: String, enum: ["indigo", "blue", "teal", "rose"], default: "indigo" }
  }
}, { timestamps: true });

module.exports = mongoose.model("Settings", settingsSchema);