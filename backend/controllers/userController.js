const bcrypt = require("bcryptjs");
const User = require("../models/User");

const roles = new Set(["admin", "hod", "coordinator", "faculty"]);
const isStrongPassword = value =>
  typeof value === "string" && value.length >= 8 &&
  /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
const publicUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  department: user.department,
  designation: user.designation,
  role: user.role,
  active: user.active,
  emailVerified: user.emailVerified,
  approvalStatus: user.approvalStatus || "approved",
  approvedAt: user.approvedAt,
  accessExpiresAt: user.accessExpiresAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

exports.listUsers = async (req, res) => {
  const filter = ["hod", "faculty"].includes(req.user.role) ? { department: req.user.department } : {};
  const users = await User.find(filter).sort({ name: 1 });
  res.json({ users: users.map(publicUser) });
};

exports.updateUser = async (req, res) => {
  const { name, email, department, role, active } = req.body;
  if (role && !roles.has(role)) return res.status(400).json({ message: "Invalid role" });
  if (req.user.role === "hod" && role === "admin") {
    return res.status(403).json({ message: "HOD cannot assign the admin role" });
  }
  if (req.params.id === req.user.id && active === false) {
    return res.status(400).json({ message: "You cannot disable your own account" });
  }

  const update = {};
  const existingUser = await User.findById(req.params.id).select("department role");
  if (!existingUser) return res.status(404).json({ message: "User not found" });
  if (req.user.role === "hod" && existingUser.department !== req.user.department) {
    return res.status(403).json({ message: "You can only manage users in your department" });
  }
  if (name !== undefined) update.name = name.trim();
  if (email !== undefined) update.email = email.trim().toLowerCase();
  if (department !== undefined) update.department = department.trim();
  if (role !== undefined) update.role = role;
  if (active !== undefined) update.active = Boolean(active);
  if (role === "coordinator" && existingUser.role !== "coordinator") {
    update.approvalStatus = "pending";
    update.approvedBy = undefined;
    update.approvedAt = undefined;
    update.accessExpiresAt = undefined;
  }
  try {
    const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: "after", runValidators: true });
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Email already registered" });
    throw error;
  }
};

exports.createUser = async (req, res) => {
  const { name, email, department, role = "faculty", password } = req.body;
  if (!name?.trim() || !email?.trim() || !department?.trim() || !password || !roles.has(role)) {
    return res.status(400).json({ message: "Name, email, department, role, and password are required" });
  }
  if (req.user.role === "hod" && role === "admin") {
    return res.status(403).json({ message: "HOD cannot create an admin" });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: "Password must be at least 8 characters and include upper, lower, and numeric characters" });
  }
  if (req.user.role === "hod" && department.trim() !== req.user.department) {
    return res.status(403).json({ message: "You can only create users in your department" });
  }
  try {
    const user = await User.create({
      name: name.trim(), email: email.trim().toLowerCase(), department: department.trim(),
      role, password: await bcrypt.hash(password, 12), active: true, emailVerified: false,
      approvalStatus: "approved",
      approvedAt: new Date(),
      accessExpiresAt: role === "coordinator" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Email already registered" });
    throw error;
  }
};

exports.updateAccess = async (req, res) => {
  const { action } = req.body;
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "Action must be approve or reject" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.role !== "faculty" && user.role !== "coordinator") {
    return res.status(400).json({ message: "Only faculty and coordinator access can be approved" });
  }
  if (req.user.role === "faculty" && (user.role !== "coordinator" || user.department !== req.user.department)) {
    return res.status(403).json({ message: "Faculty can only approve coordinators in their department" });
  }

  const now = new Date();
  user.approvalStatus = action === "approve" ? "approved" : "rejected";
  user.approvedBy = action === "approve" ? req.user._id : undefined;
  user.approvedAt = action === "approve" ? now : undefined;
  user.accessExpiresAt = action === "approve" && user.role === "coordinator"
    ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    : undefined;
  await user.save();

  return res.json({ user: publicUser(user) });
};