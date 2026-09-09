const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");

// Standard document type subfolders
const DOCUMENT_TYPES = {
  POSTER: "poster",
  ATTENDANCE: "attendance",
  FEEDBACK: "feedback",
  PHOTOS: "photos",
  REPORTS: "reports",
  DOCUMENTS: "documents" // Circulars, Permission, Certificates, Supporting Docs, Other
};

/** Map human category or legacy input to standard storage subfolder */
const mapCategoryToType = (categoryOrType) => {
  if (!categoryOrType) return DOCUMENT_TYPES.DOCUMENTS;
  const input = String(categoryOrType).trim().toLowerCase();

  if (input.includes("poster") || input.includes("invitation") || input.includes("announcement")) {
    return DOCUMENT_TYPES.POSTER;
  }
  if (input.includes("attendance") || input.includes("roster") || input.includes("hardcopy") || input.includes("scan")) {
    return DOCUMENT_TYPES.ATTENDANCE;
  }
  if (input.includes("feedback")) {
    return DOCUMENT_TYPES.FEEDBACK;
  }
  if (input.includes("photo") || input.includes("picture") || input.includes("image") || input.includes("evidence")) {
    return DOCUMENT_TYPES.PHOTOS;
  }
  if (input.includes("report") || input.includes("summary") || input.includes("final")) {
    return DOCUMENT_TYPES.REPORTS;
  }

  // Circulars, Permission, Certificates, Supporting Documents, Other
  return DOCUMENT_TYPES.DOCUMENTS;
};

/** Generate a clean, collision-free, path-traversal-resistant filename */
const sanitizeFilename = (originalName = "document.bin") => {
  const ext = path.extname(originalName).toLowerCase();
  const nameWithoutExt = path.basename(originalName, ext);
  const safeBase = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(4).toString("hex");
  return `${timestamp}_${randomHash}_${safeBase}${ext}`;
};

/** Get directory path for specific event & document type */
const getStorageDir = (eventId, documentType) => {
  const sanitizedEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const targetType = mapCategoryToType(documentType);
  return path.join(UPLOAD_ROOT, "events", sanitizedEventId, targetType);
};

/** Save uploaded file to event storage folder */
const saveFile = async (tempPath, eventId, documentType, originalFilename) => {
  const sanitizedEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const targetType = mapCategoryToType(documentType);
  const filename = sanitizeFilename(originalFilename);
  
  const targetDir = path.join(UPLOAD_ROOT, "events", sanitizedEventId, targetType);
  fs.mkdirSync(targetDir, { recursive: true });

  const absolutePath = path.join(targetDir, filename);
  const relativePath = path.join("events", sanitizedEventId, targetType, filename).replace(/\\/g, "/");

  if (tempPath && fs.existsSync(tempPath)) {
    fs.copyFileSync(tempPath, absolutePath);
    try { fs.unlinkSync(tempPath); } catch (e) { /* ignore temp cleanup error */ }
  }

  return {
    filename,
    originalFilename,
    documentType: targetType,
    storagePath: relativePath,
    absolutePath,
  };
};

/** Resolve storagePath safely to prevent directory traversal outside UPLOAD_ROOT */
const resolveFilePath = (storagePath) => {
  if (!storagePath) return null;
  const absolutePath = path.resolve(UPLOAD_ROOT, storagePath);
  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    console.error(`[StorageService] Security Block: Path traversal detected for "${storagePath}"`);
    return null;
  }
  return absolutePath;
};

/** Safely delete file at storagePath */
const deleteFile = (storagePath) => {
  try {
    const absolutePath = resolveFilePath(storagePath);
    if (absolutePath && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      return true;
    }
  } catch (error) {
    console.error(`[StorageService] Error deleting file "${storagePath}":`, error.message);
  }
  return false;
};

/** Delete entire event storage directory on event deletion */
const deleteEventStorage = (eventId) => {
  try {
    const sanitizedEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const eventDir = path.join(UPLOAD_ROOT, "events", sanitizedEventId);
    if (fs.existsSync(eventDir)) {
      fs.rmSync(eventDir, { recursive: true, force: true });
      return true;
    }
  } catch (error) {
    console.error(`[StorageService] Error removing event folder for "${eventId}":`, error.message);
  }
  return false;
};

module.exports = {
  UPLOAD_ROOT,
  DOCUMENT_TYPES,
  mapCategoryToType,
  sanitizeFilename,
  getStorageDir,
  saveFile,
  resolveFilePath,
  deleteFile,
  deleteEventStorage,
};
