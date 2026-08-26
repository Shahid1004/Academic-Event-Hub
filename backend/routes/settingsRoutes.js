const express = require("express");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { getSettings, updateSettings, updateProfile } = require("../controllers/settingsController");

const router = express.Router();
router.use(authenticate);
router.get("/", getSettings);
router.patch("/profile", updateProfile);
router.patch("/", updateSettings);

module.exports = router;