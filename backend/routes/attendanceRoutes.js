const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const {
  getEventAttendance,
  saveEventAttendance,
  qrCheckIn,
  exportAttendance,
} = require("../controllers/attendanceController");

const router = express.Router();

router.get("/event/:eventId", authenticate, getEventAttendance);
router.post("/event/:eventId/batch", authenticate, saveEventAttendance);
router.post("/event/:eventId/qr-checkin", qrCheckIn); // Public/Student accessible checkin endpoint
router.get("/event/:eventId/export", authenticate, exportAttendance);

module.exports = router;
