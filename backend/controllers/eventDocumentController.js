const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { PDFDocument } = require("pdf-lib");
const Event = require("../models/Event");
const EventDocument = require("../models/EventDocument");

const uploadRoot = path.join(__dirname, "..", "uploads", "events");
fs.mkdirSync(uploadRoot, { recursive: true });
const maxFileSize = 100 * 1024 * 1024;
const canAccessEvent = (event, user) => {
  if (!user || user.role === "admin") return true;
  const userDepartment = String(user.department || "").toUpperCase();
  const eventDepartment = String(event.department || "").toUpperCase();
  if (user.role === "hod") return eventDepartment === "BOTH" || eventDepartment === userDepartment;
  if (eventDepartment === "BOTH" || eventDepartment === userDepartment) return true;
  if (String(event.coordinator || "").toLowerCase() === String(user.name || "").toLowerCase()) return true;
  return Array.isArray(event.assignedFaculty) && event.assignedFaculty.some(id => String(id) === String(user._id));
};
const refreshEventDocumentationStatus = async eventId => {
  const requiredCategories = [
    "Event Proposal / Permission Letter", "Event Circular / Invitation", "Resource Person / Guest Documents",
    "Attendance Documents", "Feedback Documents", "Event Photographs", "Supporting Documents", "Other"
  ];
  const documents = await EventDocument.find({ eventId }).select("category").lean();
  const completed = new Set(documents.map(document => document.category));
  const completedCount = requiredCategories.filter(category => completed.has(category)).length;
  const event = await findEvent(eventId);
  if (!event) return;
  await Event.updateOne({ _id: event._id }, {
    $set: {
      docStatus: completedCount === requiredCategories.length ? "Completed" : completedCount ? "Partial" : "Pending",
      documentationCompletion: Math.round((completedCount / requiredCategories.length) * 1000) / 10
    }
  });
};
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
    if (!canAccessEvent(event, req.user)) return res.status(403).json({ success: false, message: "You do not have access to this event's documents" });
    const documents = await EventDocument.find({ eventId: event.id || req.params.eventId }).sort({ order: 1, createdAt: 1 });
    return res.json({ success: true, data: documents.map(publicDocument) });
  } catch (error) { console.error("Event document lookup failed:", error); return res.status(500).json({ success: false, message: "Unable to load event documents" }); }
};
const uploadEventDocument = async (req, res) => {
  try {
    const event = await findEvent(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!canAccessEvent(event, req.user)) return res.status(403).json({ success: false, message: "You do not have access to this event's documents" });
    if (!req.file) return res.status(400).json({ success: false, message: "A file is required" });
    const eventId = event.id || req.params.eventId;
    if (req.body.eventId && req.body.eventId !== eventId && req.body.eventId !== req.params.eventId) {
      return res.status(400).json({ success: false, message: "Event ID does not match the selected event" });
    }
    const last = await EventDocument.findOne({ eventId }).sort({ order: -1 }).select("order").lean();
    const document = await EventDocument.create({ eventId, name: req.body.documentName?.trim() || req.file.originalname, category: req.body.documentType || req.body.category || "Supporting Documents", mimeType: req.file.mimetype, size: req.file.size, storagePath: req.file.path, order: (last?.order ?? -1) + 1, uploadedBy: req.user?._id });
    await refreshEventDocumentationStatus(eventId);
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
  const event = await findEvent(document.eventId);
  if (!event || !canAccessEvent(event, req.user)) return res.status(403).json({ message: "You do not have access to this document" });
  return res.sendFile(path.resolve(document.storagePath), { headers: { "Content-Disposition": `inline; filename="${document.name.replace(/"/g, "")}"` } });
};
const deleteEventDocument = async (req, res) => {
  try {
    const document = await EventDocument.findById(req.params.documentId);
    if (!document) return res.status(404).json({ message: "Document not found" });
    const event = await findEvent(document.eventId);
    if (!event || !canAccessEvent(event, req.user)) return res.status(403).json({ message: "You do not have access to this document" });
    const eventId = document.eventId;
    if (fs.existsSync(document.storagePath)) fs.unlinkSync(document.storagePath);
    await document.deleteOne();
    await refreshEventDocumentationStatus(eventId);
    return res.json({ success: true });
  } catch (error) { console.error("Event document deletion failed:", error); return res.status(500).json({ success: false, message: "Unable to delete document" }); }
};
const replaceEventDocument = async (req, res) => {
  try {
    const document = await EventDocument.findById(req.params.documentId);
    if (!document) return res.status(404).json({ success: false, message: "Document not found" });
    const event = await findEvent(document.eventId);
    if (!event || !canAccessEvent(event, req.user)) return res.status(403).json({ success: false, message: "You do not have access to this document" });
    if (!req.file) return res.status(400).json({ success: false, message: "A file is required" });
    const previousPath = document.storagePath;
    document.name = req.body.documentName?.trim() || document.name || req.file.originalname;
    document.mimeType = req.file.mimetype;
    document.size = req.file.size;
    document.storagePath = req.file.path;
    document.status = "Uploaded";
    await document.save();
    if (previousPath && fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
    return res.json({ success: true, data: publicDocument(document) });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Event document replacement failed:", error);
    return res.status(500).json({ success: false, message: "Unable to replace document" });
  }
};
const mergeEventDocuments = async (req, res) => {
  try {
    const event = await findEvent(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!canAccessEvent(event, req.user)) return res.status(403).json({ success: false, message: "You do not have access to this event's documents" });

    const requestedOrder = Array.isArray(req.body?.documentIds) ? req.body.documentIds.map(String) : [];
    const documents = await EventDocument.find({ eventId: event.id || req.params.eventId }).sort({ order: 1, createdAt: 1 }).lean();
    const orderIndex = new Map(requestedOrder.map((id, index) => [id, index]));
    documents.sort((left, right) => {
      const leftIndex = orderIndex.has(String(left._id)) ? orderIndex.get(String(left._id)) : requestedOrder.length + left.order;
      const rightIndex = orderIndex.has(String(right._id)) ? orderIndex.get(String(right._id)) : requestedOrder.length + right.order;
      return leftIndex - rightIndex || left.order - right.order;
    });
    if (!documents.length) return res.status(400).json({ success: false, message: "No documents are available for this event. Upload at least one document before generating the merged report." });

    const mergedPdf = await PDFDocument.create();
    const unavailable = [];
    const unsupported = [];
    for (const document of documents) {
      if (!document.storagePath || !fs.existsSync(document.storagePath)) {
        unavailable.push(document.name);
        continue;
      }
      const bytes = fs.readFileSync(document.storagePath);
      const fileName = document.name.toLowerCase();
      const mimeType = (document.mimeType || "").toLowerCase();
      if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        const sourcePdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      } else if (mimeType === "image/jpeg" || mimeType === "image/jpg" || /\.(jpe?g)$/.test(fileName)) {
        const image = await mergedPdf.embedJpg(bytes);
        const page = mergedPdf.addPage([595.28, 841.89]);
        const scale = Math.min(535 / image.width, 781 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, { x: (595.28 - width) / 2, y: (841.89 - height) / 2, width, height });
      } else if (mimeType === "image/png" || fileName.endsWith(".png")) {
        const image = await mergedPdf.embedPng(bytes);
        const page = mergedPdf.addPage([595.28, 841.89]);
        const scale = Math.min(535 / image.width, 781 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, { x: (595.28 - width) / 2, y: (841.89 - height) / 2, width, height });
      } else {
        unsupported.push(document.name);
      }
    }
    if (unavailable.length || unsupported.length) {
      const problems = [...unavailable.map(name => `${name} could not be found`), ...unsupported.map(name => `${name} is not a supported PDF or image format`)];
      return res.status(422).json({ success: false, message: `Unable to generate the merged report: ${problems.join(", ")}.` });
    }
    if (!mergedPdf.getPageCount()) return res.status(422).json({ success: false, message: "No supported uploaded files are available for this event." });

    const safeName = String(event.name || event.id || "Event").replace(/[^a-z0-9+]+/gi, "_").replace(/^_+|_+$/g, "") || "Event";
    const bytes = await mergedPdf.save();
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeName}_Merged_Report.pdf"` });
    return res.send(Buffer.from(bytes));
  } catch (error) {
    console.error("Merged event report failed:", error);
    return res.status(500).json({ success: false, message: "Unable to generate the merged report" });
  }
};
module.exports = { listEventDocuments, uploadEventDocument, downloadEventDocument, deleteEventDocument, replaceEventDocument, mergeEventDocuments, uploadRoot, maxFileSize };
