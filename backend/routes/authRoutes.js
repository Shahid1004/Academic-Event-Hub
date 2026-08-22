const express = require("express");
const {
	register,
	login,
	requestPasswordReset,
	verifyPasswordOtp,
	resetPassword
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", requestPasswordReset);
router.post("/verify-otp", verifyPasswordOtp);
router.post("/reset-password", resetPassword);

module.exports = router;