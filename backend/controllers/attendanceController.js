const Attendance = require("../models/Attendance");
const Event = require("../models/Event");

const defaultStudents = [
  { regNo: "22IT001", studentName: "Arun Kumar M", className: "III IT A", department: "IT" },
  { regNo: "22IT002", studentName: "Bhavya S", className: "III IT A", department: "IT" },
  { regNo: "22IT003", studentName: "Chethan R", className: "III IT B", department: "IT" },
  { regNo: "22IT004", studentName: "Divya P", className: "III IT A", department: "IT" },
  { regNo: "22IT005", studentName: "Elan K", className: "III IT B", department: "IT" },
  { regNo: "22IT006", studentName: "Fathima N", className: "III IT A", department: "IT" },
  { regNo: "22IT007", studentName: "Ganesh S", className: "III IT B", department: "IT" },
  { regNo: "22IT008", studentName: "Harini M", className: "III IT A", department: "IT" },
];

const getEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    let records = await Attendance.find({ eventId }).sort({ regNo: 1 }).lean();

    if (records.length === 0) {
      // Provide default template list if not initialized yet
      records = defaultStudents.map((s) => ({
        eventId,
        regNo: s.regNo,
        studentName: s.studentName,
        className: s.className,
        department: s.department,
        status: "P",
        checkInMethod: "online",
        markedAt: new Date(),
      }));
    }

    const total = records.length;
    const present = records.filter((r) => r.status === "P").length;
    const absent = records.filter((r) => r.status === "A").length;
    const od = records.filter((r) => r.status === "OD").length;
    const attendancePercentage = total > 0 ? Math.round(((present + od) / total) * 100) : 0;

    return res.json({
      success: true,
      data: {
        eventId,
        summary: { total, present, absent, od, attendancePercentage },
        records,
      },
    });
  } catch (error) {
    console.error("Get attendance failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch attendance" });
  }
};

const saveEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { records } = req.body;

    if (!eventId || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: "Event ID and records array are required" });
    }

    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { eventId, regNo: rec.regNo },
        update: {
          $set: {
            studentName: rec.studentName || rec.name,
            className: rec.className || rec.class || "",
            department: rec.department || "",
            status: rec.status || "P",
            checkInMethod: rec.checkInMethod || "online",
            markedAt: rec.markedAt || new Date(),
            markedBy: req.user?._id || null,
            remarks: rec.remarks || "",
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    const allRecords = await Attendance.find({ eventId }).lean();
    const total = allRecords.length;
    const present = allRecords.filter((r) => r.status === "P").length;
    const od = allRecords.filter((r) => r.status === "OD").length;
    const absent = allRecords.filter((r) => r.status === "A").length;
    const attendancePercentage = total > 0 ? Math.round(((present + od) / total) * 100) : 0;

    // Update Event model fields
    await Event.findOneAndUpdate(
      { $or: [{ id: eventId }, { _id: mongoose.isValidObjectId(eventId) ? eventId : null }] },
      {
        $set: {
          attendance: attendancePercentage,
          actualParticipants: present + od,
        },
      }
    );

    return res.json({
      success: true,
      message: "Attendance saved successfully",
      summary: { total, present, absent, od, attendancePercentage },
      records: allRecords,
    });
  } catch (error) {
    console.error("Save attendance failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save attendance" });
  }
};

const qrCheckIn = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { regNo, studentName, className } = req.body;

    if (!eventId || !regNo) {
      return res.status(400).json({ success: false, message: "Event ID and Registration Number are required" });
    }

    const updated = await Attendance.findOneAndUpdate(
      { eventId, regNo: regNo.trim().toUpperCase() },
      {
        $set: {
          studentName: studentName || `Student ${regNo}`,
          className: className || "",
          status: "P",
          checkInMethod: "qr",
          markedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: `Check-in successful for ${regNo}`,
      data: updated,
    });
  } catch (error) {
    console.error("QR Check-in failed:", error.message);
    return res.status(500).json({ success: false, message: "QR check-in failed" });
  }
};

const exportAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const records = await Attendance.find({ eventId }).sort({ regNo: 1 }).lean();

    return res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Export attendance failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to export attendance" });
  }
};

module.exports = {
  getEventAttendance,
  saveEventAttendance,
  qrCheckIn,
  exportAttendance,
};
