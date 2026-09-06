const Feedback = require("../models/Feedback");
const Event = require("../models/Event");
const mongoose = require("mongoose");

const findEvent = async eventId => {
  const byPublicId = await Event.findOne({ id: eventId }).lean();
  if (byPublicId) return byPublicId;
  if (mongoose.Types.ObjectId.isValid(eventId)) return Event.findById(eventId).lean();
  return null;
};

const getEventFeedback = async (req, res) => {
  try {
    const { eventId } = req.params;
    let records = await Feedback.find({
      $or: [{ eventId }, { event: eventId }]
    }).sort({ createdAt: 1, _id: 1 }).lean();

    // Some existing deployments store the submitted responses inside the event document.
    // Read those records with the same public event id before reporting an empty result.
    if (!records.length) {
      const event = await findEvent(eventId);
      const embedded = event?.feedbackResponses || event?.feedbackRecords || event?.feedback;
      if (Array.isArray(embedded)) {
        records = embedded.map((record, index) => ({ ...record, eventId, _id: record._id || `embedded-${index}` }));
      }
    }

    return res.json({ success: true, data: records });
  } catch (error) {
    console.error("Feedback lookup failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load event feedback" });
  }
};

module.exports = { getEventFeedback };
