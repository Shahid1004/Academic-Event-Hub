const Event = require("../models/Event");
const User = require("../models/User");

const allowedDepartments = ["IT", "AIDS", "BOTH"];

const listEvents = async (req, res) => {
  try {
    const filter = {};
    const { search, department, type, academicYear, fromDate, toDate } = req.query;

    if (department && department !== "ALL") {
      const value = department.toString().toUpperCase();
      if (!allowedDepartments.includes(value)) {
        return res.status(400).json({ success: false, message: "Invalid department" });
      }
      filter.department = value;
    }
    if (type && type !== "ALL") filter.type = type.toString();
    if (academicYear && academicYear !== "ALL") filter.academicYear = academicYear.toString();
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) filter.date.$lte = new Date(`${toDate}T23:59:59.999Z`);
    }
    if (search?.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(escaped, "i");
      filter.$or = [{ name: expression }, { id: expression }, { coordinator: expression }, { "resourcePerson.name": expression }];
    }

    const events = await Event.find(filter).populate("assignedFaculty", "name email department designation").sort({ date: -1, createdAt: -1 }).lean();
    return res.json({ success: true, data: events });
  } catch (error) {
    console.error("Event list failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load events" });
  }
};

const listCalendarEvents = async (req, res) => {
  try {
    const { fromDate, toDate, department } = req.query;
    const filter = {};

    if (department && department !== "ALL") {
      const value = department.toString().toUpperCase();
      if (!allowedDepartments.includes(value)) {
        return res.status(400).json({ success: false, message: "Invalid department" });
      }
      filter.department = value;
    }

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) {
        const startDate = new Date(`${fromDate}T00:00:00.000Z`);
        if (Number.isNaN(startDate.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid fromDate" });
        }
        filter.date.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(`${toDate}T23:59:59.999Z`);
        if (Number.isNaN(endDate.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid toDate" });
        }
        filter.date.$lte = endDate;
      }
    }

    const events = await Event.find(filter).populate("assignedFaculty", "name email department designation").sort({ date: 1, createdAt: 1 }).lean();
    return res.json({ success: true, data: events });
  } catch (error) {
    console.error("Calendar event list failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load calendar events" });
  }
};

const createEvent = async (req, res) => {
  try {
    const { name, type, department, date, dateTo } = req.body;
    if (!name?.trim() || !type?.trim() || !allowedDepartments.includes(department) || !date) {
      return res.status(400).json({ success: false, message: "Name, type, department, and date are required" });
    }

    const assignedFaculty = Array.isArray(req.body.assignedFaculty) ? [...new Set(req.body.assignedFaculty)] : [];
    const endDate = new Date(`${dateTo || date}T00:00:00.000Z`);
    const startDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(endDate.getTime()) || endDate < startDate) {
      return res.status(400).json({ success: false, message: "Date To must be the same as or after Date From" });
    }
    const targetYears = Array.isArray(req.body.targetYears) ? [...new Set(req.body.targetYears.map(Number))] : [];
    if (targetYears.some(year => !Number.isInteger(year) || year < 1 || year > 4)) {
      return res.status(400).json({ success: false, message: "Student years must be between 1 and 4" });
    }
    if (assignedFaculty.length) {
      const facultyUsers = await User.find({ _id: { $in: assignedFaculty }, role: "faculty", active: true }).select("name");
      if (facultyUsers.length !== assignedFaculty.length) {
        return res.status(400).json({ success: false, message: "Every assigned manager must be an active faculty user" });
      }
    }

    const event = await Event.create({
      ...req.body,
      id: `EVT-${Date.now()}`,
      date: new Date(`${date}T00:00:00.000Z`),
      dateTo: endDate,
      actualParticipants: Number(req.body.actualParticipants || 0),
      expectedParticipants: Number(req.body.expectedParticipants || 0),
      status: req.body.status || "Upcoming",
      docStatus: req.body.docStatus || "Pending",
      reportStatus: req.body.reportStatus || "Not Generated",
      assignedFaculty,
      targetYears
    });
    return res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error("Event creation failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create event" });
  }
};

module.exports = { listEvents, listCalendarEvents, createEvent };
