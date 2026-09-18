const mongoose = require("mongoose");
const Event = require("../models/Event");
const User = require("../models/User");

const allowedDepartments = ["IT", "AIDS", "BOTH"];

const normalizeDepartment = (dept) => {
  if (!dept) return "";
  const s = dept.toString().trim().toUpperCase();
  if (s === "BOTH" || s.includes("BOTH") || (s.includes("IT") && s.includes("AIDS"))) return "BOTH";
  if (s === "AIDS" || s.includes("AIDS") || s.includes("AI & DATA")) return "AIDS";
  if (s === "IT" || s.includes("IT") || s.includes("INFORMATION TECHNOLOGY")) return "IT";
  return s;
};

const parseEventDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  const s = d.toString().trim();
  if (!s) return null;
  const isoStr = s.includes("T") ? s : `${s}T00:00:00.000Z`;
  const dateObj = new Date(isoStr);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
};

const listEvents = async (req, res) => {
  try {
    const filter = {};
    const { search, department, type, academicYear, fromDate, toDate } = req.query;

    if (department && department !== "ALL") {
      const value = normalizeDepartment(department);
      if (!allowedDepartments.includes(value)) {
        return res.status(400).json({ success: false, message: "Invalid department" });
      }
      filter.department = value;
    }
    if (type && type !== "ALL") filter.type = type.toString();
    if (academicYear && academicYear !== "ALL") filter.academicYear = academicYear.toString();
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = parseEventDate(fromDate) || new Date(`${fromDate}T00:00:00.000Z`);
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
    const { fromDate, toDate, department, academicYear } = req.query;
    const filter = {};

    if (department && department !== "ALL") {
      const value = normalizeDepartment(department);
      if (!allowedDepartments.includes(value)) {
        return res.status(400).json({ success: false, message: "Invalid department" });
      }
      filter.department = value;
    }
    if (academicYear && academicYear !== "ALL") filter.academicYear = academicYear.toString();

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) {
        const startDate = parseEventDate(fromDate);
        if (!startDate) {
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
    const normalizedDept = normalizeDepartment(department);

    if (!name?.trim() || !type?.trim() || !allowedDepartments.includes(normalizedDept) || !date) {
      return res.status(400).json({ success: false, message: "Name, type, department, and date are required" });
    }

    const startDate = parseEventDate(date);
    if (!startDate) {
      return res.status(400).json({ success: false, message: "Invalid event date" });
    }

    const endDate = parseEventDate(dateTo) || startDate;
    if (!endDate || endDate < startDate) {
      return res.status(400).json({ success: false, message: "Date To must be the same as or after Date From" });
    }

    const targetYears = Array.isArray(req.body.targetYears)
      ? [...new Set(req.body.targetYears.map(Number).filter(y => Number.isInteger(y) && y >= 1 && y <= 4))]
      : [];

    const rawAssigned = Array.isArray(req.body.assignedFaculty) ? req.body.assignedFaculty : [];
    const validObjectIds = [...new Set(rawAssigned.filter(id => id && mongoose.Types.ObjectId.isValid(id)))];

    let assignedFaculty = [];
    if (validObjectIds.length) {
      const coordinatorUsers = await User.find({
        _id: { $in: validObjectIds },
        active: true
      }).select("_id");
      assignedFaculty = coordinatorUsers.map(u => u._id);
    }

    const event = await Event.create({
      ...req.body,
      id: `EVT-${Date.now()}`,
      department: normalizedDept,
      date: startDate,
      dateTo: endDate,
      actualParticipants: Number(req.body.actualParticipants || 0),
      expectedParticipants: Number(req.body.expectedParticipants || 0),
      status: req.body.status || "Upcoming",
      docStatus: req.body.docStatus || "Pending",
      reportStatus: req.body.reportStatus || "Not Generated",
      assignedFaculty,
      targetYears
    });

    try {
      const { ensureDefaultStudentsSeeded } = require("./attendanceController");
      await ensureDefaultStudentsSeeded(event.id);
      if (event._id) {
        await ensureDefaultStudentsSeeded(event._id.toString());
      }
    } catch (err) {
      console.warn("Auto attendance seeding failed:", err.message);
    }

    // Automatically create event folder in OneDrive
    try {
      const oneDriveFolderService = require("../services/oneDriveFolderService");
      const folderInfo = await oneDriveFolderService.getOrCreateEventFolder(event);
      if (folderInfo?.folderId) {
        event.oneDriveFolderId = folderInfo.folderId;
        event.oneDriveFolderPath = folderInfo.folderPath;
        await Event.updateOne({ _id: event._id }, {
          $set: {
            oneDriveFolderId: folderInfo.folderId,
            oneDriveFolderPath: folderInfo.folderPath,
            semester: folderInfo.semester || event.semester
          }
        });
      }
    } catch (oneDriveErr) {
      console.warn("[EventController] Auto OneDrive folder creation notice:", oneDriveErr.message);
    }

    return res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error("Event creation failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create event" });
  }
};

const storageService = require("../services/storageService");
const oneDriveFolderService = require("../services/oneDriveFolderService");
const EventDocument = require("../models/EventDocument");
const Attendance = require("../models/Attendance");
const Feedback = require("../models/Feedback");
const FeedbackForm = require("../models/FeedbackForm");

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    let event = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      event = await Event.findById(id);
    }
    if (!event) {
      event = await Event.findOne({ id });
    }
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const oldEvent = event.toObject();

    // Update fields
    const updates = { ...req.body };
    if (updates.department) {
      updates.department = normalizeDepartment(updates.department);
    }
    if (updates.date) {
      updates.date = parseEventDate(updates.date);
    }
    if (updates.dateTo) {
      updates.dateTo = parseEventDate(updates.dateTo) || updates.date;
    }

    Object.assign(event, updates);
    await event.save();

    // Sync OneDrive event folder if name, department, year, or semester changed
    try {
      await oneDriveFolderService.syncEventFolder(event, oldEvent);
    } catch (syncErr) {
      console.warn("[EventController] Sync OneDrive folder warning:", syncErr.message);
    }

    return res.json({ success: true, data: event });
  } catch (error) {
    console.error("Update event failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update event" });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    let event = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      event = await Event.findById(id);
    }
    if (!event) {
      event = await Event.findOne({ id: id });
    }
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const publicId = event.id;
    const mongoId = event._id.toString();
    const eventIds = [...new Set([publicId, mongoId].filter(Boolean))];

    // 1. Delete associated event documents from OneDrive and disk
    const eventDocs = await EventDocument.find({ eventId: { $in: eventIds } });
    for (const doc of eventDocs) {
      try {
        await storageService.deleteFile(doc.oneDriveItemId, doc.storagePath);
      } catch (err) {
        console.warn(`Failed to delete document ${doc._id} from OneDrive:`, err.message);
      }
    }
    await EventDocument.deleteMany({ eventId: { $in: eventIds } });

    // 2. Delete entire event folder from OneDrive
    try {
      await storageService.deleteEventStorage(event);
    } catch (folderErr) {
      console.warn(`Failed to delete event folder for ${event.id} from OneDrive:`, folderErr.message);
    }

    // 3. Delete attendance records
    await Attendance.deleteMany({ $or: [{ eventId: { $in: eventIds } }, { event: { $in: eventIds } }] });

    // 4. Delete feedback records and forms
    await Feedback.deleteMany({ eventId: { $in: eventIds } });
    await FeedbackForm.deleteMany({ eventId: { $in: eventIds } });

    // 5. Delete main Event database record
    await Event.deleteOne({ _id: event._id });

    return res.json({
      success: true,
      message: "Event and all associated data deleted successfully, including OneDrive folders, documents, and database records."
    });
  } catch (error) {
    console.error("Event deletion failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete event and associated data" });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    let event = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      event = await Event.findById(id).populate("assignedFaculty", "name email department designation").lean();
    }
    if (!event) {
      event = await Event.findOne({ id }).populate("assignedFaculty", "name email department designation").lean();
    }
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    return res.json({
      success: true,
      data: {
        ...event,
        date: event.date ? event.date.toISOString().slice(0, 10) : "",
        dateTo: event.dateTo ? event.dateTo.toISOString().slice(0, 10) : event.date ? event.date.toISOString().slice(0, 10) : "",
      }
    });
  } catch (error) {
    console.error("Get event failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch event" });
  }
};

module.exports = { listEvents, listCalendarEvents, createEvent, updateEvent, deleteEvent, getEventById };
