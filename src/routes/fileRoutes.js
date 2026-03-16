import express from "express";
import { uploadFile } from "../controllers/fileController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { uploadSingleFile } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Upload a single PDF / DOC / DOCX file
// Protected route: requires JWT
router.post("/upload", authMiddleware, (req, res, next) => {
  uploadSingleFile(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, uploadFile);

export default router;

