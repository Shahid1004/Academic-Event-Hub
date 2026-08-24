const express = require("express");
const { dashboardSummary } = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/summary", authenticate, dashboardSummary);

module.exports = router;
