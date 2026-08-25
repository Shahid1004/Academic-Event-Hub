const jwt = require("jsonwebtoken");
const User = require("../models/User");

const legacyRoles = {
  ADMIN: "admin",
  FACULTY_COORDINATOR: "coordinator",
  FACULTY: "faculty"
};

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("name email department role active approvalStatus accessExpiresAt passwordChangedAt");
    if (!user || !user.active) return res.status(401).json({ message: "Authentication required" });
    const normalizedRole = legacyRoles[user.role] || user.role;
    if (normalizedRole !== user.role) {
      user.role = normalizedRole;
      await User.updateOne({ _id: user._id }, { $set: { role: normalizedRole } });
    }
    if (user.approvalStatus && user.approvalStatus !== "approved") return res.status(403).json({ message: "Account access is not approved" });
    if (user.role === "coordinator" && user.accessExpiresAt && user.accessExpiresAt <= new Date()) {
      return res.status(403).json({ message: "Coordinator access has expired" });
    }
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Authentication required" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You are not authorized for this action" });
  }
  next();
};

module.exports = { authenticate, authorize };