const express = require("express");
const multer = require("multer");
const { authorize } = require("../middleware/authMiddleware");
const {
	listEventDocuments, uploadEventDocument, downloadEventDocument, deleteEventDocument, replaceEventDocument, mergeEventDocuments,
	uploadRoot, maxFileSize
} = require("../controllers/eventDocumentController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: maxFileSize },
});

const uploadFile = (req, res, next) => upload.single("file")(req, res, error => {
	if (!error) return next();
	console.error("Document multipart upload failed:", error);
	const message = error.code === "LIMIT_FILE_SIZE" ? "File exceeds the 100 MB upload limit" : error.message || "Unable to upload file";
	return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ success: false, message });
});

router.get("/event/:eventId", authenticate, listEventDocuments);
router.post("/event/:eventId", authenticate, authorize("admin", "hod", "coordinator", "faculty"), uploadFile, uploadEventDocument);
router.post("/merged/event/:eventId", authenticate, authorize("admin", "hod", "coordinator", "faculty"), mergeEventDocuments);
router.get("/file/:documentId", authenticate, downloadEventDocument);
router.delete("/:documentId", authenticate, authorize("admin", "hod", "coordinator", "faculty"), deleteEventDocument);
router.put("/:documentId", authenticate, authorize("admin", "hod", "coordinator", "faculty"), uploadFile, replaceEventDocument);

module.exports = router;
