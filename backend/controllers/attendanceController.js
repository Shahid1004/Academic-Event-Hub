const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");

const findEvent = async eventId => {
  const byPublicId = await Event.findOne({ id: eventId }).lean();
  if (byPublicId) return byPublicId;
  if (mongoose.Types.ObjectId.isValid(eventId)) return Event.findById(eventId).lean();
  return null;
};

const getEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const records = await Attendance.find({ $or: [{ eventId }, { event: eventId }] }).lean();
    const event = await findEvent(eventId);
    const presentRecords = records.filter(record => ['present', 'p', 'od'].includes(String(record.status || '').toLowerCase()));
    const absentRecords = records.filter(record => ['absent', 'a'].includes(String(record.status || '').toLowerCase()));
    const departments = {};
    records.forEach(record => {
      if (!record.department) return;
      if (!departments[record.department]) departments[record.department] = { present: 0, absent: 0, total: 0 };
      departments[record.department].total += 1;
      if (presentRecords.includes(record)) departments[record.department].present += 1;
      if (absentRecords.includes(record)) departments[record.department].absent += 1;
    });

    if (records.length) {
      return res.json({ success: true, data: {
        source: 'attendance-records', expectedParticipants: event?.expectedParticipants,
        actualParticipants: records.length, present: presentRecords.length, absent: absentRecords.length,
        attendancePercentage: records.length ? (presentRecords.length / records.length) * 100 : undefined,
        departmentParticipation: departments
      }});
    }

    return res.json({ success: true, data: {
      source: 'event-record', expectedParticipants: event?.expectedParticipants,
      actualParticipants: event?.actualParticipants, present: undefined, absent: undefined,
      attendancePercentage: event?.attendance, departmentParticipation: {}
    }});
  } catch (error) {
    console.error("Attendance lookup failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load event attendance" });
  }
};

module.exports = { getEventAttendance };
