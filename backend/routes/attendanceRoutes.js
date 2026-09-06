const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { getEventAttendance } = require("../controllers/attendanceController");

const router = express.Router();

router.get("/event/:eventId", authenticate, getEventAttendance);

module.exports = router;
