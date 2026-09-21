const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true
});

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET environment variable is not configured!");
}

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const eventRoutes = require("./routes/eventRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const eventDocumentRoutes = require("./routes/eventDocumentRoutes");
const studentRoutes = require("./routes/studentRoutes");
const aiReportRoutes = require("./routes/aiReportRoutes");
const oneDriveAuthRoutes = require("./routes/oneDriveAuthRoutes");

const app = express();

const getMongoUri = () => {
  const configuredUri = process.env.MONGO_URI?.trim();
  if (!configuredUri) {
    throw new Error("MONGO_URI is not configured");
  }

  // Use the configured URI directly so environments that block SRV DNS queries
  // can connect through Atlas' explicit host list.
  return configuredUri;
};

const configuredOrigin = process.env.FRONTEND_URL || process.env.CORS_ORIGIN;

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Same-origin, mobile browser, curl, Postman
  if (process.env.NODE_ENV !== "production") return true; // Local development
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return true;
  if (configuredOrigin && (origin === configuredOrigin || origin === configuredOrigin.replace(/\/$/, ""))) return true;
  if (origin.endsWith(".vercel.app")) return true; // Any Vercel deployment preview/production URL
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);
app.use(express.json());

// Cache connection promise across serverless invocations
let cachedDbPromise = null;

const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cachedDbPromise) {
    const mongoUri = getMongoUri();
    cachedDbPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    }).then(() => {
      console.log("MongoDB connected");
      return mongoose.connection;
    }).catch((err) => {
      cachedDbPromise = null;
      console.error("MongoDB connection failed:", err.message);
      throw err;
    });
  }

  return cachedDbPromise;
};

// Start connection attempt immediately
connectToDatabase().catch((err) => {
  console.error("Initial MongoDB connection attempt error:", err.message);
});

app.get(["/api/test", "/test"], async (req, res) => {
  let dbStatus = "disconnected";
  let errorMsg = null;
  try {
    await connectToDatabase();
    dbStatus = "connected";
  } catch (err) {
    dbStatus = "error";
    errorMsg = err.message;
  }

  res.json({
    message: "Backend is working",
    dbReadyState: mongoose.connection.readyState,
    dbStatus,
    error: errorMsg
  });
});

app.get(["/", "/api"], async (req, res) => {
  res.json({
    message: "Academic Event Hub API is running",
    dbReadyState: mongoose.connection.readyState
  });
});

// Middleware to ensure DB is connected before handling /api routes
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("Database connection unavailable for request:", req.path, error.message);
    return res.status(500).json({
      message: "Database connection failed. Please check server logs and configuration."
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/event-documents", eventDocumentRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/ai-report", aiReportRoutes);
app.use("/api/onedrive/auth", oneDriveAuthRoutes);

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
  });
}

module.exports = app;