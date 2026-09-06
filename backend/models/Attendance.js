const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  eventId: { type: String, index: true },
  event: { type: String, index: true },
  studentId: { type: String },
  studentName: { type: String },
  department: { type: String },
  status: { type: String, trim: true },
}, { timestamps: true, strict: false });

attendanceSchema.index({ eventId: 1, status: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
