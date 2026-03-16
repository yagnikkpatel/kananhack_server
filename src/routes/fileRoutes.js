import express from "express";
import {
  uploadFile,
  deleteFile,
  getFileById,
  getAllFiles,
  classifyFile,
  getMarksheetDetails,
  getSopSummary,
  getPancardSummary,
  getSopAnalysis,
} from "../controllers/fileController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { uploadSingleFile } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Upload a single PDF / DOC / DOCX file
// Protected route: requires JWT
router.post(
  "/upload",
  authMiddleware,
  (req, res, next) => {
    uploadSingleFile(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadFile
);

// Get file by id (download)
// Protected route: requires JWT, only owner can access
router.get("/:id", authMiddleware, getFileById);

// Get all files for current user
// Protected route: requires JWT
router.get("/", authMiddleware, getAllFiles);

// Classify a file and update documentType
// Protected route: requires JWT, only owner can classify
router.post("/:id/classify", authMiddleware, classifyFile);

// Extract detailed marksheet info via Gemini
// Protected route: requires JWT, only owner can access
router.post("/:id/marksheet-details", authMiddleware, getMarksheetDetails);

// Summarize SOP via Gemini
// Protected route: requires JWT, only owner can access
router.post("/:id/sop-summary", authMiddleware, getSopSummary);

// AI SOP Analysis & Improvement Suggestions
router.post("/:id/sop-analysis", authMiddleware, getSopAnalysis);

// Extract PAN card details via Gemini
// Protected route: requires JWT, only owner can access
router.post("/:id/pancard-summary", authMiddleware, getPancardSummary);

// Delete uploaded file by id
// Protected route: requires JWT, only owner can delete
router.delete("/:id", authMiddleware, deleteFile);

export default router;

