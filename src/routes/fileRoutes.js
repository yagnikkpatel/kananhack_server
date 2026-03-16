import express from "express";
import { uploadFile, deleteFile, getFileById, getAllFiles } from "../controllers/fileController.js";
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

// Delete uploaded file by id
// Protected route: requires JWT, only owner can delete
router.delete("/:id", authMiddleware, deleteFile);

export default router;

