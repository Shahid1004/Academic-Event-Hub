const express = require("express");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { listUsers, updateUser, updateAccess, createUser } = require("../controllers/userController");

const router = express.Router();
router.use(authenticate);
router.get("/", authorize("admin", "hod", "faculty"), listUsers);
router.post("/", authorize("admin", "hod"), createUser);
router.patch("/:id", authorize("admin", "hod"), updateUser);
router.patch("/:id/access", authorize("admin", "faculty"), updateAccess);

module.exports = router;