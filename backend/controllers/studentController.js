const jwt = require("jsonwebtoken");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const Feedback = require("../models/Feedback");
const FeedbackForm = require("../models/FeedbackForm");

const normalizeRegNo = value => String(value || "").trim().toUpperCase();

const findEvent = async eventId => {
  const clauses = [{ id: eventId }];
  if (/^[a-f\d]{24}$/i.test(String(eventId))) clauses.push({ _id: eventId });
  return Event.findOne({ $or: clauses }).lean();
};

const attendanceFilter = regNo => ({
  regNo: {
    $regex: `^${String(regNo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    $options: "i"
  }
});

const publicEvent = event => ({
  id: event.id || String(event._id),
  name: event.name,
  type: event.type,
  department: event.department,
  academicYear: event.academicYear,
  date: event.date,
  dateTo: event.dateTo,
  startTime: event.startTime || "",
  endTime: event.endTime || "",
  venue: event.venue || "",
  mode: event.mode || "",
  status: event.status,
  coordinator: event.coordinator || "",
  docStatus: event.docStatus,
  feedbackScore: event.feedbackScore || 0,
});

const studentLogin = async (req, res) => {
  try {
    const regNo = normalizeRegNo(req.body.registerNumber || req.body.regNo);
    if (!regNo) return res.status(400).json({ message: "Register number is required" });

    const records = await Attendance.find(attendanceFilter(regNo)).select("eventId").lean();
    console.log(`[StudentLogin] regNo=${regNo}, attendance records found=${records.length}`);

    const eventIds = [...new Set(records.map(r => r.eventId).filter(Boolean))];
    if (!eventIds.length) {
      console.log(`[StudentLogin] No events found for regNo=${regNo}`);
      return res.status(401).json({ message: "You are not part of any events." });
    }

    const token = jwt.sign({ student: true, regNo }, process.env.JWT_SECRET, { expiresIn: "1d" });
    console.log(`[StudentLogin] Success: regNo=${regNo}, eventIds=${eventIds.join(", ")}`);
    return res.json({ message: "Student login successful", token, student: { registerNumber: regNo } });
  } catch (error) {
    console.error("[StudentLogin] Error:", error);
    return res.status(500).json({ message: "Unable to complete student login" });
  }
};

const getStudentEvents = async (req, res) => {
  try {
    const regNo = req.student.regNo;
    const records = await Attendance.find(attendanceFilter(regNo)).select("eventId studentName").lean();
    const ids = [...new Set(records.map(r => r.eventId).filter(Boolean))];
    console.log(`[getStudentEvents] regNo=${regNo}, eventIds=${ids.join(", ")}`);

    const mongoIds = ids.filter(id => /^[a-f\d]{24}$/i.test(id));
    const queryOr = [{ id: { $in: ids } }];
    if (mongoIds.length) queryOr.push({ _id: { $in: mongoIds } });

    const events = await Event.find({ $or: queryOr }).sort({ date: -1 }).lean();
    const studentName = records.find(r => r.studentName)?.studentName || "";
    console.log(`[getStudentEvents] Found ${events.length} events for regNo=${regNo}`);

    return res.json({ success: true, data: events.map(publicEvent), studentName });
  } catch (error) {
    console.error("[getStudentEvents] Error:", error);
    return res.status(500).json({ message: "Unable to load student events" });
  }
};

const getStudentEvent = async (req, res) => {
  try {
    const eventId = String(req.params.eventId);
    const event = await findEvent(eventId);
    const record = await Attendance.findOne({
      ...attendanceFilter(req.student.regNo),
      eventId
    }).lean();
    if (!event || !record) return res.status(404).json({ message: "Event not found" });
    return res.json({ success: true, data: publicEvent(event) });
  } catch (error) {
    console.error("[getStudentEvent] Error:", error);
    return res.status(500).json({ message: "Unable to load event" });
  }
};

const getStudentFeedback = async (req, res) => {
  try {
    const eventId = String(req.params.eventId);
    const event = await findEvent(eventId);
    const attendance = await Attendance.findOne({
      ...attendanceFilter(req.student.regNo),
      eventId
    }).lean();
    if (!event || !attendance) {
      return res.status(403).json({ message: "You are not part of this event" });
    }
    const resolvedEventId = event.id || eventId;
    const storedForm = await FeedbackForm.findOne({ eventId: resolvedEventId }).lean();
    if (!storedForm || storedForm.status !== "Published") {
      return res.json({
        success: true,
        data: { form: null, status: storedForm?.status || null, submitted: false }
      });
    }
    const submission = await Feedback.findOne({
      eventId: resolvedEventId,
      feedbackFormId: storedForm._id,
      regNo: req.student.regNo
    }).select("submittedAt").lean();
    return res.json({
      success: true,
      data: { form: storedForm, submitted: Boolean(submission), submittedAt: submission?.submittedAt }
    });
  } catch (error) {
    console.error("[getStudentFeedback] Error:", error);
    return res.status(500).json({ message: "Unable to load feedback" });
  }
};

const submitStudentFeedback = async (req, res) => {
  try {
    const eventId = String(req.params.eventId);
    const event = await findEvent(eventId);
    const attendance = await Attendance.findOne({
      ...attendanceFilter(req.student.regNo),
      eventId
    }).lean();
    if (!event || !attendance) {
      return res.status(403).json({ message: "You are not part of this event" });
    }
    const resolvedEventId = event.id || eventId;
    const form = await FeedbackForm.findOne({ eventId: resolvedEventId, status: "Published" }).lean();
    if (!form) {
      return res.status(404).json({ message: "Feedback form is not available for this event yet." });
    }
    const answers = req.body.answers && typeof req.body.answers === "object" ? req.body.answers : {};
    const missing = form.questions.filter(q =>
      q.required && (answers[q.id] === undefined || String(answers[q.id]).trim() === "")
    );
    if (missing.length) {
      return res.status(400).json({ message: `Please answer: ${missing.map(q => q.text).join(", ")}` });
    }
    for (const q of form.questions) {
      const ans = answers[q.id];
      if (ans === undefined || ans === null || ans === "") continue;
      if (q.type === "rating" && (!Number.isInteger(Number(ans)) || Number(ans) < 1 || Number(ans) > 5)) {
        return res.status(400).json({ message: `Invalid answer for ${q.text}` });
      }
      if (q.type === "yes-no" && !["Yes", "No"].includes(String(ans))) {
        return res.status(400).json({ message: `Invalid answer for ${q.text}` });
      }
      if (q.type === "multiple-choice" && (!q.options?.length || !q.options.includes(String(ans)))) {
        return res.status(400).json({ message: `Invalid answer for ${q.text}` });
      }
    }
    const submission = await Feedback.create({
      eventId: resolvedEventId,
      feedbackFormId: form._id,
      regNo: req.student.regNo,
      answers,
      submittedAt: new Date()
    });
    const allSubmissions = await Feedback.find({ eventId: resolvedEventId, feedbackFormId: form._id }).select("answers").lean();
    const ratings = form.questions
      .filter(q => q.type === "rating")
      .flatMap(q => allSubmissions.map(s => Number(s.answers?.[q.id])).filter(Number.isFinite));
    await Event.updateOne(
      { _id: event._id },
      { $set: { feedbackScore: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : 0 } }
    );
    return res.status(201).json({ success: true, data: { submitted: true, submittedAt: submission.submittedAt } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Feedback already submitted." });
    console.error("[submitStudentFeedback] Error:", error);
    return res.status(500).json({ message: "Unable to submit feedback" });
  }
};

const upsertFeedbackForm = async (req, res) => {
  try {
    const eventId = String(req.params.eventId);
    const event = await findEvent(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Authorization check
    const userRole = req.user.role;
    const userDept = String(req.user.department || "").toUpperCase();
    const eventDept = String(event.department || "").toUpperCase();
    // Department match: event is BOTH (all departments) OR event dept matches user dept
    const deptMatch = eventDept === "BOTH" || eventDept === userDept || userDept === "BOTH";

    let allowed = false;
    if (userRole === "admin") {
      allowed = true;
    } else if (userRole === "hod") {
      allowed = deptMatch;
    } else if (userRole === "coordinator" || userRole === "faculty") {
      // Allow if department matches - department-level access for faculty
      allowed = deptMatch;
    }

    if (!allowed) {
      console.log(`[upsertFeedbackForm] Access denied: user=${req.user._id} role=${userRole} dept=${userDept}, event dept=${eventDept}`);
      return res.status(403).json({ message: "You do not have access to this event's feedback form" });
    }

    // Parse and validate questions
    const questions = Array.isArray(req.body.questions)
      ? req.body.questions.map((q, idx) => ({
          id: String(q.id || `question-${idx + 1}`),
          text: String(q.text || "").trim(),
          type: q.type && ["rating", "multiple-choice", "yes-no", "text", "dropdown"].includes(q.type) ? q.type : "text",
          required: Boolean(q.required),
          options: Array.isArray(q.options) ? q.options.map(String).map(o => o.trim()).filter(Boolean) : []
        })).filter(q => q.text)
      : [];

    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "A title is required" });
    if (!questions.length) return res.status(400).json({ message: "At least one question is required" });
    if (questions.some(q => q.type === "multiple-choice" && q.options.length < 2)) {
      return res.status(400).json({ message: "Multiple-choice questions need at least two options" });
    }

    const resolvedEventId = event.id || eventId;

    // Build the update payload using $set so we don't overwrite unset fields accidentally
    const setData = {
      title,
      questions,
      eventId: resolvedEventId,
      createdBy: req.user._id,
    };

    // Only update status if explicitly provided and valid
    const requestedStatus = req.body.status;
    if (requestedStatus && ["Draft", "Published", "Closed"].includes(requestedStatus)) {
      setData.status = requestedStatus;
      if (requestedStatus === "Published") setData.publishedAt = new Date();
    }

    const form = await FeedbackForm.findOneAndUpdate(
      { eventId: resolvedEventId },
      { $set: setData },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    console.log(`[upsertFeedbackForm] Saved: eventId=${resolvedEventId}, status=${form.status}, questions=${form.questions.length}`);
    return res.json({ success: true, data: form });
  } catch (error) {
    console.error("[upsertFeedbackForm] Error:", error);
    return res.status(500).json({ message: `Unable to save feedback form: ${error.message}` });
  }
};

module.exports = {
  studentLogin,
  getStudentEvents,
  getStudentEvent,
  getStudentFeedback,
  submitStudentFeedback,
  upsertFeedbackForm
};