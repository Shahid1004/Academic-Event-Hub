const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    regNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    className: {
      type: String,
      trim: true,
      default: "",
    },
    department: {
      type: String,
      trim: true,
      default: "-",
    },
    status: {
      type: String,
      enum: ["P", "A", "OD", ""],
      default: "",
    },
    checkInMethod: {
      type: String,
      enum: ["online", "qr", "hardcopy", "excel", "import", "manual"],
      default: "online",
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ eventId: 1, regNo: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
