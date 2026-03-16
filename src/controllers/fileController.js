import File from "../models/File.js";

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { originalname, mimetype, size, buffer } = req.file;

    const fileDoc = await File.create({
      owner: req.user ? req.user._id : undefined,
      originalName: originalname,
      mimeType: mimetype,
      size,
      data: buffer,
    });

    return res.status(201).json({
      message: "File uploaded successfully",
      file: {
        id: fileDoc._id,
        originalName: fileDoc.originalName,
        mimeType: fileDoc.mimeType,
        size: fileDoc.size,
        createdAt: fileDoc.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in uploadFile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findById(id);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Optional ownership check: only the owner can delete
    if (file.owner && req.user && file.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not allowed to delete this file" });
    }

    await file.deleteOne();

    return res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error in deleteFile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getFileById = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findById(id);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Optional ownership check: only the owner can access
    if (file.owner && req.user && file.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not allowed to access this file" });
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}"`
    );

    return res.send(file.data);
  } catch (error) {
    console.error("Error in getFileById:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllFiles = async (req, res) => {
  try {
    const query = {};

    // If you want to restrict to current user's files only:
    if (req.user) {
      query.owner = req.user._id;
    }

    const files = await File.find(query)
      .select("originalName mimeType size createdAt owner")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: files.length,
      files,
    });
  } catch (error) {
    console.error("Error in getAllFiles:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

