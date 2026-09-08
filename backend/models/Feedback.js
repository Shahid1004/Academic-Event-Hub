const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  eventId: { type: String, required: true, index: true },
  feedbackFormId: { type: mongoose.Schema.Types.ObjectId, ref: "FeedbackForm", index: true },
  regNo: { type: String, trim: true, index: true },
  answers: { type: mongoose.Schema.Types.Mixed },
  submittedAt: { type: Date },
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
feedbackSchema.index({ eventId: 1, feedbackFormId: 1, regNo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Feedback", feedbackSchema);
