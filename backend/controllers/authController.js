const User = require("../models/User");
const PasswordReset = require("../models/PasswordReset");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const createOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashValue = value => crypto.createHash("sha256").update(value).digest("hex");
const allowedRoles = new Set(["admin", "hod", "coordinator", "faculty"]);
const legacyRoles = {
  ADMIN: "admin",
  FACULTY_COORDINATOR: "coordinator",
  FACULTY: "faculty"
};
const normalizeEmail = value => value?.trim().toLowerCase();
const isStrongPassword = value =>
  typeof value === "string" && value.length >= 8 &&
  /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);

const mailTransport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    })
  : null;

exports.register = async (req, res) => {
  try {
    const { name, password, department, role = "faculty" } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!name?.trim() || !email || !department || !["coordinator", "faculty"].includes(role) || !isStrongPassword(password)) {
      return res.status(400).json({
        message: "Enter a valid name, email, department, and a strong password"
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      department,
      role,
      active: true,
      emailVerified: false
    });

    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Registration failed"
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = email ? await User.findOne({ email }) : null;

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if (!user.active) {
      return res.status(403).json({ message: "This account is disabled" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const role = legacyRoles[user.role] || user.role;
    if (!allowedRoles.has(role)) {
      return res.status(403).json({ message: "This account has an invalid role" });
    }

    if (role !== user.role) {
      await User.updateOne({ _id: user._id }, { $set: { role } });
    }

    const token = jwt.sign(
      {
        id: user._id.toString()
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        role,
        active: user.active
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed"
    });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = email ? await User.findOne({ email }) : null;

    if (user) {
      if (!mailTransport) {
        console.error("Password reset unavailable: SMTP is not configured");
        return res.status(503).json({ message: "Password reset is temporarily unavailable" });
      }

      const previousReset = await PasswordReset.findOne({ email });
      if (previousReset?.lastRequestedAt &&
          Date.now() - previousReset.lastRequestedAt.getTime() < 60 * 1000) {
        return res.status(429).json({ message: "Please wait before requesting another code" });
      }
      if (previousReset?.requestCount >= 5 &&
          Date.now() - previousReset.createdAt.getTime() < 60 * 60 * 1000) {
        return res.status(429).json({ message: "Too many verification requests. Try again later" });
      }

      const otp = createOtp();
      await PasswordReset.deleteMany({ email });
      await PasswordReset.create({
        email,
        otpHash: hashValue(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        lastRequestedAt: new Date(),
        requestCount: (previousReset?.requestCount || 0) + 1
      });

      if (mailTransport) {
        await mailTransport.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: "Academic Event Hub password reset code",
          text: `Your Academic Event Hub verification code is ${otp}. It expires in 10 minutes.`
        });
      }
    }

    res.json({ message: "If that email is registered, a verification code has been sent." });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ message: "Unable to send verification code" });
  }
};

exports.verifyPasswordOtp = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();
    const reset = await PasswordReset.findOne({ email });

    if (!reset || reset.expiresAt < new Date() || reset.verifiedAt || reset.attempts >= 5) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    if (!/^\d{6}$/.test(otp || "") || hashValue(otp) !== reset.otpHash) {
      reset.attempts += 1;
      await reset.save();
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    reset.resetTokenHash = hashValue(resetToken);
    reset.verifiedAt = new Date();
    await reset.save();

    res.json({ message: "Code verified", resetToken });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Unable to verify code" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { resetToken, password } = req.body;
    const reset = await PasswordReset.findOne({ email });

    if (!reset || !reset.verifiedAt || reset.expiresAt < new Date() ||
        hashValue(resetToken || "") !== reset.resetTokenHash) {
      return res.status(400).json({ message: "Reset session is invalid or expired" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters and include upper, lower, and numeric characters" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Unable to reset password" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date();
    await user.save();
    await PasswordReset.deleteOne({ _id: reset._id });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Unable to reset password" });
  }
};