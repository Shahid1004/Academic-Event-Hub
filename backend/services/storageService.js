const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const msGraphConfig = require("../config/msGraphConfig");
const oneDriveAuthService = require("./oneDriveAuthService");
const oneDriveFolderService = require("./oneDriveFolderService");

const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");

// Standard document type subfolders/categories
const DOCUMENT_TYPES = {
  POSTER: "poster",
  ATTENDANCE: "attendance",
  FEEDBACK: "feedback",
  PHOTOS: "photos",
  REPORTS: "reports",
  DOCUMENTS: "documents",
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

  return DOCUMENT_TYPES.DOCUMENTS;
};

/** Generate a clean, collision-free, path-traversal-resistant filename */
const sanitizeFilename = (originalName = "document.bin") => {
  const ext = path.extname(originalName).toLowerCase();
  const nameWithoutExt = path.basename(originalName, ext);
  const safeBase = nameWithoutExt.replace(/[\\/:*?"<>|#%\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(3).toString("hex");
  return `${timestamp}_${randomHash}_${safeBase}${ext}`;
};

/**
 * Upload a file directly to Microsoft OneDrive in the correct event folder.
 * Handles small files (<=4MB) via simple PUT and large files (>4MB) via upload sessions.
 */
const uploadFile = async (fileBuffer, originalFilename, event, category = "documents", mimeType = "application/octet-stream") => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error("Invalid file buffer provided for upload");
  }

  const accessToken = await oneDriveAuthService.getAccessToken();

  // 1. Get or create the OneDrive event folder hierarchy
  const { folderId, folderPath } = await oneDriveFolderService.getOrCreateEventFolder(event);

  const targetType = mapCategoryToType(category);
  const safeFilename = sanitizeFilename(originalFilename);
  const fileSize = fileBuffer.length;

  let driveItem = null;

  // 2. Upload file based on size
  const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB

  if (fileSize <= SIMPLE_UPLOAD_LIMIT) {
    // Normal simple upload
    const uploadUrl = `${msGraphConfig.graphApiEndpoint}/me/drive/items/${folderId}:/${encodeURIComponent(safeFilename)}:/content`;
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`OneDrive upload failed (${response.status}): ${errData.error?.message || response.statusText}`);
    }

    driveItem = await response.json();
  } else {
    // Large file upload session (> 4MB)
    const sessionUrl = `${msGraphConfig.graphApiEndpoint}/me/drive/items/${folderId}:/${encodeURIComponent(safeFilename)}:/createUploadSession`;
    const sessionRes = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "rename",
          name: safeFilename,
        },
      }),
    });

    if (!sessionRes.ok) {
      const errData = await sessionRes.json().catch(() => ({}));
      throw new Error(`Failed to create OneDrive upload session (${sessionRes.status}): ${errData.error?.message || sessionRes.statusText}`);
    }

    const sessionData = await sessionRes.json();
    const uploadUrl = sessionData.uploadUrl;

    // Microsoft Graph chunks must be multiples of 320 KiB (327,680 bytes)
    const CHUNK_SIZE = 320 * 1024 * 10; // 3.2 MB per chunk
    let start = 0;

    while (start < fileSize) {
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const chunk = fileBuffer.subarray(start, end);
      const chunkLength = end - start;

      const chunkRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunkLength),
          "Content-Range": `bytes ${start}-${end - 1}/${fileSize}`,
        },
        body: chunk,
      });

      if (!chunkRes.ok && chunkRes.status !== 200 && chunkRes.status !== 201 && chunkRes.status !== 202) {
        const errData = await chunkRes.json().catch(() => ({}));
        throw new Error(`OneDrive chunk upload failed at ${start}-${end}: ${errData.error?.message || chunkRes.statusText}`);
      }

      if (chunkRes.status === 200 || chunkRes.status === 201) {
        driveItem = await chunkRes.json();
        break;
      }

      start = end;
    }
  }

  if (!driveItem?.id) {
    throw new Error("OneDrive upload completed but did not return a valid file ID");
  }

  console.log(`[StorageService] Uploaded "${originalFilename}" to OneDrive [${folderPath}/${safeFilename}] (ID: ${driveItem.id})`);

  return {
    filename: driveItem.name || safeFilename,
    originalFilename,
    documentType: targetType,
    oneDriveItemId: driveItem.id,
    oneDriveParentFolderId: folderId,
    oneDriveWebUrl: driveItem.webUrl || "",
    storagePath: driveItem.webUrl || `onedrive://${driveItem.id}`,
    size: driveItem.size || fileSize,
    mimeType: driveItem.file?.mimeType || mimeType,
    folderPath,
  };
};

/**
 * Get file content stream from OneDrive (or fallback local file for legacy documents)
 */
const getFileStream = async (oneDriveItemId, storagePath) => {
  // If OneDrive Item ID exists, stream directly from Microsoft Graph
  if (oneDriveItemId) {
    const accessToken = await oneDriveAuthService.getAccessToken();
    const downloadUrl = `${msGraphConfig.graphApiEndpoint}/me/drive/items/${oneDriveItemId}/content`;

    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: "follow",
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`OneDrive download failed (${response.status}): ${err}`);
    }

    return {
      stream: response.body,
      contentType: response.headers.get("content-type") || "application/octet-stream",
      contentLength: response.headers.get("content-length"),
    };
  }

  // Fallback for legacy files stored locally
  if (storagePath) {
    const absolutePath = resolveFilePath(storagePath);
    if (absolutePath && fs.existsSync(absolutePath)) {
      return {
        stream: fs.createReadStream(absolutePath),
        contentType: "application/octet-stream",
        contentLength: fs.statSync(absolutePath).size,
      };
    }
  }

  throw new Error("Document file could not be found in OneDrive or local storage");
};

/**
 * Retrieve file as an in-memory Buffer (for PDF merging, AI analysis, etc.)
 */
const getFileBuffer = async (oneDriveItemId, storagePath) => {
  if (oneDriveItemId) {
    const accessToken = await oneDriveAuthService.getAccessToken();
    const downloadUrl = `${msGraphConfig.graphApiEndpoint}/me/drive/items/${oneDriveItemId}/content`;

    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`OneDrive getFileBuffer failed (${response.status}): ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (storagePath) {
    const absolutePath = resolveFilePath(storagePath);
    if (absolutePath && fs.existsSync(absolutePath)) {
      return fs.readFileSync(absolutePath);
    }
  }

  throw new Error("Document file could not be found in OneDrive or local storage");
};

/**
 * Delete a file in OneDrive (or local fallback)
 */
const deleteFile = async (oneDriveItemId, storagePath) => {
  let deletedFromCloud = false;

  if (oneDriveItemId) {
    try {
      const accessToken = await oneDriveAuthService.getAccessToken();
      const deleteUrl = `${msGraphConfig.graphApiEndpoint}/me/drive/items/${oneDriveItemId}`;
      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok || response.status === 404) {
        deletedFromCloud = true;
      }
    } catch (err) {
      console.warn(`[StorageService] Failed to delete OneDrive item ${oneDriveItemId}:`, err.message);
    }
  }

  // Also clean up local file if present
  if (storagePath) {
    try {
      const absolutePath = resolveFilePath(storagePath);
      if (absolutePath && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (e) {
      /* ignore */
    }
  }

  return deletedFromCloud;
};

/**
 * Delete entire event folder from OneDrive when event is deleted
 */
const deleteEventStorage = async (event) => {
  if (!event) return false;
  return await oneDriveFolderService.deleteEventFolder(event);
};

/**
 * Save generated permanent reports (Attendance Report, Feedback Report, AI Analysis, Final Report, Merged Report)
 * directly into the event's OneDrive folder as requested.
 */
const saveGeneratedReport = async (event, reportFileName, pdfBuffer, category = "reports") => {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error("Valid PDF buffer is required to save generated report");
  }

  return await uploadFile(
    pdfBuffer,
    reportFileName,
    event,
    category,
    "application/pdf"
  );
};

/**
 * Resolve legacy local storage paths safely
 */
const resolveFilePath = (storagePath) => {
  if (!storagePath || storagePath.startsWith("http") || storagePath.startsWith("onedrive://")) {
    return null;
  }
  const absolutePath = path.resolve(UPLOAD_ROOT, storagePath);
  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    return null;
  }
  return absolutePath;
};

module.exports = {
  UPLOAD_ROOT,
  DOCUMENT_TYPES,
  mapCategoryToType,
  sanitizeFilename,
  uploadFile,
  getFileStream,
  getFileBuffer,
  deleteFile,
  deleteEventStorage,
  saveGeneratedReport,
  resolveFilePath,
};
