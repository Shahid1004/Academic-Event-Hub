const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true
});

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const eventRoutes = require("./routes/eventRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

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

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/attendance", attendanceRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Academic Event Hub API is running" });
});

let mongoUri;
try {
  mongoUri = getMongoUri();
  mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000
  })
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err.message);
      console.log("Warning: Continuing to run server without a working database.");
    });
} catch (error) {
  console.error(`MongoDB configuration failed: ${error.message}`);
}

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running on port " + (process.env.PORT || 5000));
});