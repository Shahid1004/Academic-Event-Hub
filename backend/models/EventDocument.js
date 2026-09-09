const mongoose = require("mongoose");

const eventDocumentSchema = new mongoose.Schema({
  eventId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true }, // Display name or title
  filename: { type: String, trim: true }, // Stored filename
  originalFilename: { type: String, trim: true }, // Original uploaded file name
  documentType: {
    type: String,
    enum: ["poster", "attendance", "feedback", "photos", "reports", "documents"],
    default: "documents",
    index: true,
  },
  category: { type: String, required: true, trim: true }, // Human readable category name
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  storagePath: { type: String, required: true }, // Relative storage path e.g. events/{eventId}/{type}/{filename}
  order: { type: Number, default: 0 },
  status: { type: String, default: "Uploaded" },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });

eventDocumentSchema.index({ eventId: 1, documentType: 1 });
eventDocumentSchema.index({ eventId: 1, order: 1 });

module.exports = mongoose.model("EventDocument", eventDocumentSchema);
