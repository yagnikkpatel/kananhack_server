import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    documentType: {
      type: String,
      enum: [
        "passport",
        "pancard",
        "marksheet",
        "statement_of_purpose",
        "recommendation_letter",
        "unknown",
        undefined,
      ],
    },
    // Cached AI extraction result (verification_status, authenticity_score, summary, etc.)
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

const File = mongoose.model("File", fileSchema);

export default File;

