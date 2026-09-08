const jwt = require("jsonwebtoken");

const studentAuthenticate = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const payload = token ? jwt.verify(token, process.env.JWT_SECRET) : null;
    if (!payload?.student || !payload.regNo) return res.status(401).json({ message: "Student authentication required" });
    req.student = { regNo: String(payload.regNo).trim() };
    next();
  } catch {
    return res.status(401).json({ message: "Student authentication required" });
  }
};

module.exports = { studentAuthenticate };