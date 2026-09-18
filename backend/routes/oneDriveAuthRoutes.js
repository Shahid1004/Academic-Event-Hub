const express = require("express");
const { startAuthLogin, handleAuthCallback, getStatus, disconnect } = require("../controllers/oneDriveAuthController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Public OAuth initiation and callback routes
router.get("/login", startAuthLogin);
router.get("/callback", handleAuthCallback);

// Status check (accessible to authenticated users)
router.get("/status", getStatus);

// Disconnect route (restricted to admin / hod)
router.post("/disconnect", authenticate, authorize("admin", "hod"), disconnect);

module.exports = router;
