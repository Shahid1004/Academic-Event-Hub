const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const EventDocument = require("../models/EventDocument");

const uploadRoot = path.join(__dirname, "..", "uploads", "events");
fs.mkdirSync(uploadRoot, { recursive: true });
const maxFileSize = 100 * 1024 * 1024;
const findEvent = async eventId => {
  const byPublicId = await Event.findOne({ id: eventId }).lean();
  if (byPublicId) return byPublicId;
  if (mongoose.Types.ObjectId.isValid(eventId)) return Event.findById(eventId).lean();
  return null;
};
const publicDocument = document => ({
  id: document._id.toString(), documentId: document._id.toString(), eventId: document.eventId,
  name: document.name, documentName: document.name, fileName: document.name,
  category: document.category, documentType: document.category, type: document.mimeType,
  mimeType: document.mimeType, size: document.size, url: `/api/event-documents/file/${document._id}`,
  fileUrl: `/api/event-documents/file/${document._id}`, order: document.order,
  status: document.status, uploadedDate: document.createdAt, uploadedAt: document.createdAt
});

const listEventDocuments = async (req, res) => {
  try {
    const event = await findEvent(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    const documents = await EventDocument.find({ eventId: event.id || req.params.eventId }).sort({ order: 1, createdAt: 1 });
    return res.json({ success: true, data: documents.map(publicDocument) });
  } catch (error) { console.error("Event document lookup failed:", error); return res.status(500).json({ success: false, message: "Unable to load event documents" }); }
};
const uploadEventDocument = async (req, res) => {
  try {
    const event = await findEvent(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!req.file) return res.status(400).json({ success: false, message: "A file is required" });
    const eventId = event.id || req.params.eventId;
    if (req.body.eventId && req.body.eventId !== eventId && req.body.eventId !== req.params.eventId) {
      return res.status(400).json({ success: false, message: "Event ID does not match the selected event" });
    }
    const last = await EventDocument.findOne({ eventId }).sort({ order: -1 }).select("order").lean();
    const document = await EventDocument.create({ eventId, name: req.body.documentName?.trim() || req.file.originalname, category: req.body.documentType || req.body.category || "Supporting Documents", mimeType: req.file.mimetype, size: req.file.size, storagePath: req.file.path, order: (last?.order ?? -1) + 1, uploadedBy: req.user?._id });
    return res.status(201).json({ success: true, data: publicDocument(document) });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Event document upload failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to upload document" });
  }
};
const downloadEventDocument = async (req, res) => {
  const document = await EventDocument.findById(req.params.documentId).lean();
  if (!document || !fs.existsSync(document.storagePath)) return res.status(404).json({ message: "Document not found" });
  return res.sendFile(path.resolve(document.storagePath), { headers: { "Content-Disposition": `inline; filename="${document.name.replace(/"/g, "")}"` } });
};
const deleteEventDocument = async (req, res) => {
  try {
    const document = await EventDocument.findById(req.params.documentId);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (fs.existsSync(document.storagePath)) fs.unlinkSync(document.storagePath);
    await document.deleteOne();
    return res.json({ success: true });
  } catch (error) { console.error("Event document deletion failed:", error); return res.status(500).json({ success: false, message: "Unable to delete document" }); }
};
module.exports = { listEventDocuments, uploadEventDocument, downloadEventDocument, deleteEventDocument, uploadRoot, maxFileSize };
