const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { getEventFeedback, getFeedbackForm, getFeedbackAnalytics } = require("../controllers/feedbackController");

const router = express.Router();

router.get("/event/:eventId", authenticate, getEventFeedback);
router.get("/event/:eventId/form", authenticate, getFeedbackForm);
router.get("/event/:eventId/analytics", authenticate, getFeedbackAnalytics);

module.exports = router;
