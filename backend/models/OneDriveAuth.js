const mongoose = require("mongoose");

const oneDriveAuthSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "primary" },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    accountEmail: { type: String, trim: true, default: "" },
    accountName: { type: String, trim: true, default: "" },
    tenantId: { type: String, trim: true, default: "" },
    driveId: { type: String, trim: true, default: "" },
    rootFolderId: { type: String, trim: true, default: "" },
    scope: { type: String, default: "" },
    lastRefreshedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OneDriveAuth", oneDriveAuthSchema);
