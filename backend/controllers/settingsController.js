const Settings = require("../models/Settings");
const User = require("../models/User");

const defaults = {
  academicYears: [
    { name: "2023-24", current: false },
    { name: "2024-25", current: false },
    { name: "2025-26", current: true },
    { name: "2026-27", current: false }
  ],
  departments: [
    { name: "Information Technology", code: "IT", hod: "", strength: 0 },
    { name: "AI & Data Science", code: "AIDS", hod: "", strength: 0 }
  ],
  eventTypes: ["Hackathon", "Vervathon", "Guest Lecture", "Workshop", "Webinar", "Seminar", "Symposium", "FDP", "Training Event", "Conference", "Joint Event", "Other"],
  documentCategories: ["Event Proposal", "Attendance Sheet", "Feedback Form", "Event Report", "Payment Document"],
  notifications: {
    attendancePending: true,
    feedbackCompleted: true,
    paymentPending: true,
    reportGenerated: true,
    documentationCompleted: false,
    upcomingEvent: true,
    newEventAssigned: true
  },
  theme: { mode: "light", contrast: "normal", accent: "indigo" }
};

const publicSettings = (settings, theme) => ({
  academicYears: settings.academicYears,
  departments: settings.departments,
  eventTypes: settings.eventTypes,
  documentCategories: settings.documentCategories,
  notifications: settings.notifications,
  theme: theme || settings.theme
});

const publicProfile = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  department: user.department,
  role: user.role,
  active: user.active,
  employeeId: user.employeeId,
  phone: user.phone,
  designation: user.designation,
  avatarColor: user.avatarColor
});

const getOrCreateSettings = async () => Settings.findOneAndUpdate(
  { key: "default" },
  { $setOnInsert: { key: "default", ...defaults } },
  { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
);

exports.getSettings = async (req, res) => {
  const settings = await getOrCreateSettings();
  const user = await User.findById(req.user._id).select("name email department role employeeId phone designation avatarColor preferences");
  res.json({ settings: publicSettings(settings, user.preferences?.theme), profile: publicProfile(user) });
};

exports.updateSettings = async (req, res) => {
  await getOrCreateSettings();
  const user = await User.findById(req.user._id).select("preferences");
  const globalKeys = ["academicYears", "departments", "eventTypes", "documentCategories", "notifications"];
  const hasGlobalUpdate = globalKeys.some(key => req.body[key] !== undefined);
  if (hasGlobalUpdate && !["admin", "hod"].includes(req.user.role)) {
    return res.status(403).json({ message: "Only admin or HOD can change shared settings" });
  }

  let currentUser = user;
  if (req.body.theme !== undefined) {
    const theme = req.body.theme || {};
    currentUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: Object.fromEntries(
        ["mode", "contrast", "accent"]
          .filter(key => theme[key] !== undefined)
          .map(key => [`preferences.theme.${key}`, theme[key]])
      ) },
      { returnDocument: "after", runValidators: true }
    );
  }

  const allowed = globalKeys;
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  const settings = await Settings.findOneAndUpdate(
    { key: "default" },
    { $set: update },
    { returnDocument: "after", runValidators: true }
  );
  res.json({ settings: publicSettings(settings, currentUser.preferences?.theme) });
};

exports.updateProfile = async (req, res) => {
  const allowed = ["name", "email", "employeeId", "phone", "designation", "avatarColor"];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
  }
  const user = await User.findByIdAndUpdate(req.user._id, update, { returnDocument: "after", runValidators: true });
  res.json({ profile: publicProfile(user) });
};