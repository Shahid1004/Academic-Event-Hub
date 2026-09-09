const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const {
  getEventAttendance,
  saveEventAttendance,
  qrCheckIn,
  exportAttendance,
  importEventAttendanceRoster,
  scanHardCopyAttendance,
  addStudentToAttendance,
} = require("../controllers/attendanceController");

const router = express.Router();

router.get("/event/:eventId", authenticate, getEventAttendance);
router.post("/event/:eventId/batch", authenticate, saveEventAttendance);
router.post("/event/:eventId/add-student", authenticate, addStudentToAttendance);
router.post("/event/:eventId/import", authenticate, importEventAttendanceRoster);
router.post("/scan-hardcopy", upload.fields([{ name: "file", maxCount: 1 }, { name: "files", maxCount: 20 }]), scanHardCopyAttendance);
router.post("/event/:eventId/qr-checkin", qrCheckIn); // Public/Student accessible checkin endpoint
router.get("/event/:eventId/export", authenticate, exportAttendance);

module.exports = router;
