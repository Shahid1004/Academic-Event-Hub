const mongoose = require("mongoose");

const eventDocumentSchema = new mongoose.Schema({
  eventId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  storagePath: { type: String, required: true },
  order: { type: Number, required: true },
  status: { type: String, default: "Uploaded" },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

eventDocumentSchema.index({ eventId: 1, order: 1 });
module.exports = mongoose.model("EventDocument", eventDocumentSchema);
