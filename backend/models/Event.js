const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  id: { type: String, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true, index: true },
  academicYear: { type: String, trim: true, index: true },
  targetYears: [{ type: Number, min: 1, max: 4 }],
  date: { type: Date, index: true },
  dateTo: { type: Date, index: true },
  coordinator: { type: String, trim: true },
  assignedFaculty: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  sponsoredBy: { type: String, trim: true },
  actualParticipants: { type: Number, default: 0 },
  attendance: { type: Number, default: 0 },
  feedbackScore: { type: Number, default: 0 },
  docStatus: { type: String, trim: true },
  status: { type: String, trim: true, index: true },
  semester: { type: String, trim: true },
  oneDriveFolderId: { type: String, trim: true, index: true },
  oneDriveFolderPath: { type: String, trim: true },
}, { timestamps: true, strict: false });

eventSchema.index({ academicYear: 1, department: 1, date: -1 });
eventSchema.index({ academicYear: 1, status: 1, type: 1 });

module.exports = mongoose.model("Event", eventSchema);
