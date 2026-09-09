const Feedback = require("../models/Feedback");
const FeedbackForm = require("../models/FeedbackForm");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const mongoose = require("mongoose");

const findEvent = async eventId => {
  const byPublicId = await Event.findOne({ id: eventId }).lean();
  if (byPublicId) return byPublicId;
  if (mongoose.Types.ObjectId.isValid(eventId)) return Event.findById(eventId).lean();
  return null;
};

const canManageEventFeedback = (event, user) => {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  const department = String(user.department || "").toUpperCase();
  const eventDepartment = String(event.department || "").toUpperCase();
  // HOD: same dept or BOTH events
  if (user.role === "hod") return eventDepartment === "BOTH" || eventDepartment === department;
  // Faculty/Coordinator: same department match (BOTH events accessible to all faculty)
  const deptMatch = eventDepartment === "BOTH" || eventDepartment === department;
  if (!deptMatch) return false;
  return true;
};

const getEventFeedback = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await findEvent(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!canManageEventFeedback(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this event's feedback" });
    }
    const resolvedEventId = event.id || eventId;
    let records = await Feedback.find({
      $or: [{ eventId: resolvedEventId }, { event: resolvedEventId }]
    }).sort({ createdAt: 1, _id: 1 }).lean();

    if (!records.length) {
      const embedded = event?.feedbackResponses || event?.feedbackRecords || event?.feedback;
      if (Array.isArray(embedded)) {
        records = embedded.map((record, index) => ({ ...record, eventId: resolvedEventId, _id: record._id || `embedded-${index}` }));
      }
    }

    return res.json({ success: true, data: records });
  } catch (error) {
    console.error("[getEventFeedback] Error:", error);
    return res.status(500).json({ success: false, message: "Unable to load event feedback" });
  }
};

const getFeedbackForm = async (req, res) => {
  try {
    const event = await findEvent(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!canManageEventFeedback(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this event's feedback" });
    }
    const resolvedEventId = event.id || req.params.eventId;
    const form = await FeedbackForm.findOne({ eventId: resolvedEventId }).lean();
    console.log(`[getFeedbackForm] eventId=${resolvedEventId}, form=${form ? form._id : "none"}`);
    return res.json({ success: true, data: form });
  } catch (error) {
    console.error("[getFeedbackForm] Error:", error);
    return res.status(500).json({ success: false, message: "Unable to load feedback form" });
  }
};

const getFeedbackAnalytics = async (req, res) => {
  try {
    const event = await findEvent(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!canManageEventFeedback(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this event's feedback" });
    }
    const resolvedEventId = event.id || req.params.eventId;
    const form = await FeedbackForm.findOne({ eventId: resolvedEventId }).lean();
    // Query feedback records by eventId — if a form exists, prefer form-linked records;
    // otherwise fall back to ALL feedback for this event (matching getEventFeedback behavior).
    let records;
    if (form) {
      records = await Feedback.find({ eventId: resolvedEventId, feedbackFormId: form._id }).lean();
      // If no form-linked records found, also check for feedback without feedbackFormId
      if (!records.length) {
        records = await Feedback.find({
          $or: [{ eventId: resolvedEventId }, { event: resolvedEventId }]
        }).lean();
      }
    } else {
      records = await Feedback.find({
        $or: [{ eventId: resolvedEventId }, { event: resolvedEventId }]
      }).lean();
    }
    const attendanceRecords = await Attendance.find({
      $or: [{ eventId: resolvedEventId }, { event: resolvedEventId }]
    }).select("regNo").lean();

    const eligibleStudents = new Set(
      attendanceRecords.map(r => String(r.regNo || "").trim().toUpperCase()).filter(Boolean)
    );
    const submittedStudents = new Set(
      records.map(r => String(r.regNo || "").trim().toUpperCase()).filter(Boolean)
    );
    const totalStudents = eligibleStudents.size;
    const submittedStudentsCount = [...submittedStudents].filter(regNo => eligibleStudents.has(regNo)).length;
    const submissionPercentage = totalStudents
      ? Math.round((submittedStudentsCount / totalStudents) * 1000) / 10
      : 0;

    const questionAnalysis = (form?.questions || []).map(q => {
      const values = records
        .map(r => r.answers?.[q.id])
        .filter(v => v !== undefined && v !== null && v !== "");
      if (q.type === "rating") {
        const numbers = values.map(Number).filter(Number.isFinite);
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          average: numbers.length ? numbers.reduce((sum, v) => sum + v, 0) / numbers.length : null,
          distribution: Object.fromEntries([1, 2, 3, 4, 5].map(v => [v, numbers.filter(n => n === v).length]))
        };
      }
      if (q.type === "text") {
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          comments: values.map(a => ({ question: q.text, answer: String(a) }))
        };
      }
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        distribution: Object.fromEntries(
          (q.options?.length ? q.options : ["Yes", "No"]).map(option => [
            option,
            values.filter(v => String(v) === option).length
          ])
        )
      };
    });

    const ratingValues = questionAnalysis.flatMap(q =>
      q.type === "rating" && q.average !== null
        ? records.map(r => Number(r.answers?.[q.id])).filter(Number.isFinite)
        : []
    );
    const ratingDistribution = Object.fromEntries(
      [1, 2, 3, 4, 5].map(v => [v, ratingValues.filter(n => n === v).length])
    );

    return res.json({
      success: true,
      data: {
        totalResponses: records.length,
        totalStudents,
        submittedStudents: submittedStudentsCount,
        submissionPercentage,
        averageRating: ratingValues.length
          ? ratingValues.reduce((sum, v) => sum + v, 0) / ratingValues.length
          : null,
        ratingDistribution,
        questionAnalysis,
        comments: questionAnalysis.flatMap(q => q.type === "text" ? q.comments : [])
      }
    });
  } catch (error) {
    console.error("[getFeedbackAnalytics] Error:", error);
    return res.status(500).json({ success: false, message: "Unable to load feedback analytics" });
  }
};

module.exports = { getEventFeedback, getFeedbackForm, getFeedbackAnalytics };
