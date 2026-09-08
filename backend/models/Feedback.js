const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  eventId: { type: String, required: true, index: true },
  overallRating: { type: Number },
  sessionContentRating: { type: Number },
  speakerEffectivenessRating: { type: Number },
  usefulnessToStudents: { type: Number },
  overallSatisfaction: { type: Number },
  response: { type: String, trim: true },
  comment: { type: String, trim: true },
  comments: { type: String, trim: true },
}, { timestamps: true, strict: false });

feedbackSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
