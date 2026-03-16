import express from "express";
import {
  getProgress,
  getDashboard,
  submitApplication,
} from "../controllers/applicationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/application/progress
// Returns uploaded docs, missing docs, and completion %
router.get("/progress", authMiddleware, getProgress);

// GET /api/application/dashboard
// Full dashboard: counts, per-doc details, verification statuses
router.get("/dashboard", authMiddleware, getDashboard);

// POST /api/application/submit
// Submission gate: blocks if docs are missing or flagged as suspicious/invalid
router.post("/submit", authMiddleware, submitApplication);

export default router;
