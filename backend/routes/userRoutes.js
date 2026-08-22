const express = require("express");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { listUsers, updateUser, createUser } = require("../controllers/userController");

const router = express.Router();
router.use(authenticate, authorize("admin", "hod"));
router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);

module.exports = router;