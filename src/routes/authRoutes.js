import express from "express";
import { registerUser, loginUser } from "../controllers/authController.js";

const router = express.Router();

// Register: fullName, email, password
router.post("/register", registerUser);

// Login: email, password
router.post("/login", loginUser);

export default router;

