const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true, trim: true },
  type: { type: String, enum: ["rating", "multiple-choice", "yes-no", "text", "dropdown"], default: "text" },
  options: [{ type: String, trim: true }],
  required: { type: Boolean, default: false },
}, { _id: false });

const feedbackFormSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  status: { type: String, enum: ["Draft", "Published", "Closed"], default: "Draft", index: true },
  questions: { type: [questionSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  publishedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("FeedbackForm", feedbackFormSchema);