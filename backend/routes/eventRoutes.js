const express = require("express");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { listEvents, listCalendarEvents, createEvent, updateEvent, deleteEvent, getEventById } = require("../controllers/eventController");

const router = express.Router();

router.get("/", authenticate, listEvents);
router.get("/calendar", authenticate, listCalendarEvents);
router.get("/:id", authenticate, getEventById);
router.post("/", authenticate, authorize("admin", "hod", "coordinator"), createEvent);
router.put("/:id", authenticate, authorize("admin", "hod", "coordinator", "faculty"), updateEvent);
router.patch("/:id", authenticate, authorize("admin", "hod", "coordinator", "faculty"), updateEvent);
router.delete("/:id", authenticate, authorize("admin", "hod", "coordinator", "faculty"), deleteEvent);

module.exports = router;
