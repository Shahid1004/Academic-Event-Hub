const express = require("express");
const { authorize, authenticate } = require("../middleware/authMiddleware");
const { studentAuthenticate } = require("../middleware/studentAuthMiddleware");
const { studentLogin, getStudentEvents, getStudentEvent, getStudentFeedback, submitStudentFeedback, upsertFeedbackForm } = require("../controllers/studentController");

const router = express.Router();
router.post("/login", studentLogin);
router.get("/events", studentAuthenticate, getStudentEvents);
router.get("/events/:eventId", studentAuthenticate, getStudentEvent);
router.get("/events/:eventId/feedback", studentAuthenticate, getStudentFeedback);
router.post("/events/:eventId/feedback", studentAuthenticate, submitStudentFeedback);
router.put("/events/:eventId/feedback-form", authenticate, authorize("admin", "hod", "coordinator", "faculty"), upsertFeedbackForm);

module.exports = router;