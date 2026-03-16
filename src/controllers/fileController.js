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

