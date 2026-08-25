const express = require("express");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { listEvents, listCalendarEvents, createEvent } = require("../controllers/eventController");

const router = express.Router();

router.get("/", authenticate, listEvents);
router.get("/calendar", authenticate, listCalendarEvents);
router.post("/", authenticate, authorize("admin", "hod", "coordinator"), createEvent);

module.exports = router;
