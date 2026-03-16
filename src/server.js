import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

// auth routes
app.use("/api/auth", authRoutes);
// file routes
app.use("/api/files", fileRoutes);
// application progress / dashboard / submission routes
app.use("/api/application", applicationRoutes);

const PORT = process.env.PORT || 3100;

// health check route
app.get("/health", (req, res) => {
  res.status(200).json({ message: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port: http://localhost:${PORT}`);
  connectDB();
});
