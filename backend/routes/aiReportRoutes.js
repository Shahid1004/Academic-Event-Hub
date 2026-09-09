const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { generateAIReport } = require("../controllers/aiReportController");

const router = express.Router();

// POST /api/ai-report/event/:eventId — Generate AI-powered final event report
router.post("/event/:eventId", authenticate, generateAIReport);

module.exports = router;
