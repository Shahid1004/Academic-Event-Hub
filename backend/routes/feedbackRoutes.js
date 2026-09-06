const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { getEventFeedback } = require("../controllers/feedbackController");

const router = express.Router();

router.get("/event/:eventId", authenticate, getEventFeedback);

module.exports = router;
