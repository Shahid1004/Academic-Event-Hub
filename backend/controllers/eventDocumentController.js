const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { PDFDocument } = require("pdf-lib");
const Event = require("../models/Event");
const EventDocument = require("../models/EventDocument");
const storageService = require("../services/storageService");

const maxFileSize = 100 * 1024 * 1024; // 100 MB limit

/** Authorization helper to check if user has access to an event */
const canAccessEvent = (event, user) => {
  if (!user || user.role === "admin") return true;
  const userDepartment = String(user.department || "").toUpperCase();
  const eventDepartment = String(event.department || "").toUpperCase();

  if (user.role === "hod") {
    return eventDepartment === "BOTH" || eventDepartment === userDepartment;
  }
  if (eventDepartment === "BOTH" || eventDepartment === userDepartment) return true;
  if (String(event.coordinator || "").toLowerCase() === String(user.name || "").toLowerCase()) return true;
  return Array.isArray(event.assignedFaculty) && event.assignedFaculty.some(id => String(id) === String(user._id));
};

/** Refresh documentation completion status on event model */
const refreshEventDocumentationStatus = async (eventId) => {
  const requiredCategories = [
    "Event Proposal / Permission Letter", "Event Circular / Invitation", "Resource Person / Guest Documents",
    "Attendance Documents", "Feedback Documents", "Event Photographs", "Supporting Documents", "Other"
  ];
  const documents = await EventDocument.find({ eventId }).select("category documentType").lean();
  const completed = new Set(documents.map(doc => doc.category));
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

/** Find event by public eventId (e.g. EVT-101) or Mongo _id */
const findEvent = async (eventId) => {
  const byPublicId = await Event.findOne({ id: eventId }).lean();
  if (byPublicId) return byPublicId;
  if (mongoose.Types.ObjectId.isValid(eventId)) return Event.findById(eventId).lean();
  return null;
};

/** Public DTO formatter for EventDocument */
const publicDocument = (document) => {
  const docType = document.documentType || storageService.mapCategoryToType(document.category);
  const displayName = document.name || document.originalFilename || document.filename || "Document";
  const origName = document.originalFilename || document.name || document.filename || "file";

  return {
    id: document._id.toString(),
    documentId: document._id.toString(),
    eventId: document.eventId,
    name: displayName,
    documentName: displayName,
    fileName: origName,
    filename: document.filename || origName,
    originalFilename: origName,
    category: document.category || "Other",
    documentType: docType,
    type: document.mimeType,
    mimeType: document.mimeType,
    size: document.size,
    storagePath: document.storagePath,
    url: `/api/event-documents/file/${document._id}`,
    fileUrl: `/api/event-documents/file/${document._id}`,
    order: document.order || 0,
    status: document.status || "Uploaded",
    uploadedBy: document.uploadedBy,
    uploadedDate: document.uploadedAt || document.createdAt,
    uploadedAt: document.uploadedAt || document.createdAt,
  };
};

/** List all documents for an event */
const listEventDocuments = async (req, res) => {
  try {
    const rawEventId = req.params.eventId;
    const event = await findEvent(rawEventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    if (!canAccessEvent(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this event's documents" });
    }
    const resolvedEventId = event.id || rawEventId;
    const documents = await EventDocument.find({
      $or: [{ eventId: resolvedEventId }, { eventId: rawEventId }]
    }).sort({ order: 1, createdAt: 1 });

    return res.json({ success: true, data: documents.map(publicDocument) });
  } catch (error) {
    console.error("Event document lookup failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load event documents" });
  }
};

/** Upload a new document to structured event subfolder */
const uploadEventDocument = async (req, res) => {
  try {
    const rawEventId = req.params.eventId;
    const event = await findEvent(rawEventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    if (!canAccessEvent(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this event's documents" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "A file is required" });
    }

    const resolvedEventId = event.id || rawEventId;
    const categoryInput = req.body.documentType || req.body.category || "Other";
    const docType = storageService.mapCategoryToType(categoryInput);
    const originalName = req.file.originalname || "file";
    const displayName = req.body.documentName?.trim() || req.body.name?.trim() || originalName;

    // Save physical file via storageService
    const saved = await storageService.saveFile(
      req.file.path,
      resolvedEventId,
      docType,
      originalName
    );

    const last = await EventDocument.findOne({ eventId: resolvedEventId }).sort({ order: -1 }).select("order").lean();

    const document = await EventDocument.create({
      eventId: resolvedEventId,
      name: displayName,
      filename: saved.filename,
      originalFilename: originalName,
      documentType: docType,
      category: categoryInput,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: saved.storagePath,
      order: (last?.order ?? -1) + 1,
      status: "Uploaded",
      uploadedBy: req.user?._id,
      uploadedAt: new Date(),
    });

    await refreshEventDocumentationStatus(resolvedEventId);
    return res.status(201).json({ success: true, data: publicDocument(document) });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    }
    console.error("Event document upload failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to upload document" });
  }
};

/** Download or view a document */
const downloadEventDocument = async (req, res) => {
  try {
    const document = await EventDocument.findById(req.params.documentId).lean();
    if (!document) {
      return res.status(404).json({ success: false, message: "Document record not found" });
    }

    const event = await findEvent(document.eventId);
    if (!event || !canAccessEvent(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this document" });
    }

    const absolutePath = storageService.resolveFilePath(document.storagePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: "Physical document file not found on server" });
    }

    const safeFilename = (document.originalFilename || document.name || "file").replace(/"/g, "");
    return res.sendFile(absolutePath, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeFilename}"`
      }
    });
  } catch (error) {
    console.error("Document download failed:", error);
    return res.status(500).json({ success: false, message: "Unable to download document" });
  }
};

/** Delete a document record and its physical file */
const deleteEventDocument = async (req, res) => {
  try {
    const document = await EventDocument.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    const event = await findEvent(document.eventId);
    if (!event || !canAccessEvent(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to delete this document" });
    }

    const eventId = document.eventId;
    storageService.deleteFile(document.storagePath);
    await document.deleteOne();
    await refreshEventDocumentationStatus(eventId);

    return res.json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    console.error("Event document deletion failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete document" });
  }
};

/** Replace an existing document */
const replaceEventDocument = async (req, res) => {
  try {
    const document = await EventDocument.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    const event = await findEvent(document.eventId);
    if (!event || !canAccessEvent(event, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this document" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "A file is required" });
    }

    const previousStoragePath = document.storagePath;
    const categoryInput = req.body.documentType || req.body.category || document.category || "Other";
    const docType = storageService.mapCategoryToType(categoryInput);
    const originalName = req.file.originalname || document.originalFilename || "file";

    const saved = await storageService.saveFile(
      req.file.path,
      document.eventId,
      docType,
      originalName
    );

    document.name = req.body.documentName?.trim() || req.body.name?.trim() || document.name || originalName;
    document.filename = saved.filename;
    document.originalFilename = originalName;
    document.documentType = docType;
    document.category = categoryInput;
    document.mimeType = req.file.mimetype;
    document.size = req.file.size;
    document.storagePath = saved.storagePath;
    document.status = "Uploaded";
    document.uploadedAt = new Date();
    await document.save();

    if (previousStoragePath && previousStoragePath !== saved.storagePath) {
      storageService.deleteFile(previousStoragePath);
    }

    return res.json({ success: true, data: publicDocument(document) });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    }
    console.error("Event document replacement failed:", error);
    return res.status(500).json({ success: false, message: "Unable to replace document" });
  }
};

/** Merge event PDFs/images into a single PDF report */
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

    if (!documents.length) {
      return res.status(400).json({ success: false, message: "No documents are available for this event. Upload at least one document before generating the merged report." });
    }

    const mergedPdf = await PDFDocument.create();
    const unavailable = [];
    const unsupported = [];

    for (const document of documents) {
      const absolutePath = storageService.resolveFilePath(document.storagePath);
      if (!absolutePath || !fs.existsSync(absolutePath)) {
        unavailable.push(document.name);
        continue;
      }
      const bytes = fs.readFileSync(absolutePath);
      const fileName = (document.originalFilename || document.name || "").toLowerCase();
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
    if (!mergedPdf.getPageCount()) {
      return res.status(422).json({ success: false, message: "No supported uploaded files are available for this event." });
    }

    const safeName = String(event.name || event.id || "Event").replace(/[^a-z0-9+]+/gi, "_").replace(/^_+|_+$/g, "") || "Event";
    const bytes = await mergedPdf.save();
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeName}_Merged_Report.pdf"` });
    return res.send(Buffer.from(bytes));
  } catch (error) {
    console.error("Merged event report failed:", error);
    return res.status(500).json({ success: false, message: "Unable to generate the merged report" });
  }
};

module.exports = {
  listEventDocuments,
  uploadEventDocument,
  downloadEventDocument,
  deleteEventDocument,
  replaceEventDocument,
  mergeEventDocuments,
  uploadRoot: storageService.UPLOAD_ROOT,
  maxFileSize
};
