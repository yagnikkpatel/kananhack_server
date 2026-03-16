import File from "../models/File.js";

// The 3 document types every application MUST have
const REQUIRED_DOCS = ["pancard", "marksheet", "statement_of_purpose"];

/**
 * Helper – fetch all classified (non-unknown) files owned by the current user
 * and build a map: documentType → file document (latest by createdAt).
 */
async function buildDocMap(userId) {
  const files = await File.find({
    owner: userId,
    documentType: { $in: REQUIRED_DOCS },
  })
    .select("documentType extractedData originalName createdAt mimeType size")
    .sort({ createdAt: -1 });

  // Keep only the most-recent upload per type
  const map = {};
  for (const file of files) {
    if (!map[file.documentType]) {
      map[file.documentType] = file;
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/application/progress
// ─────────────────────────────────────────────────────────────────────────────
export const getProgress = async (req, res) => {
  try {
    const docMap = await buildDocMap(req.user._id);

    const uploaded = Object.keys(docMap);
    const missing = REQUIRED_DOCS.filter((d) => !docMap[d]);
    const completion = Math.round((uploaded.length / REQUIRED_DOCS.length) * 100);

    return res.status(200).json({
      uploaded,
      missing,
      completion,
    });
  } catch (error) {
    console.error("Error in getProgress:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/application/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboard = async (req, res) => {
  try {
    const docMap = await buildDocMap(req.user._id);

    const uploaded = Object.keys(docMap);
    const missing = REQUIRED_DOCS.filter((d) => !docMap[d]);
    const completion = Math.round((uploaded.length / REQUIRED_DOCS.length) * 100);

    // Build the per-document detail array
    const documents = uploaded.map((type) => {
      const file = docMap[type];
      const extracted = file.extractedData || {};

      const entry = {
        type,
        file_id: file._id,
        original_name: file.originalName,
        uploaded_at: file.createdAt,
        verification_status: extracted.verification_status || "pending",
      };

      // Attach authenticity_score if present
      if (extracted.authenticity_score !== undefined) {
        entry.authenticity_score = extracted.authenticity_score;
      }

      // Attach a one-line summary if present
      if (extracted.summary) {
        entry.summary = extracted.summary;
      }

      return entry;
    });

    return res.status(200).json({
      documents_uploaded: uploaded.length,
      documents_required: REQUIRED_DOCS.length,
      completion_percentage: completion,
      missing_documents: missing,
      documents,
    });
  } catch (error) {
    console.error("Error in getDashboard:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/application/submit
// ─────────────────────────────────────────────────────────────────────────────
export const submitApplication = async (req, res) => {
  try {
    const docMap = await buildDocMap(req.user._id);

    const missing = REQUIRED_DOCS.filter((d) => !docMap[d]);

    // ── Submission gate ──────────────────────────────────────────────────────
    if (missing.length > 0) {
      return res.status(400).json({
        message: "Application incomplete. Please upload all required documents before submitting.",
        missing,
      });
    }

    // ── Authenticity & Completion gate ──────────────────────────────────────
    const suspicious = [];
    const unverified = [];

    for (const type of REQUIRED_DOCS) {
      const file = docMap[type];
      const extracted = file.extractedData;

      if (!extracted) {
        unverified.push(type);
      } else if (
        extracted.verification_status === "suspicious" ||
        extracted.verification_status === "invalid"
      ) {
        suspicious.push({ type, verification_status: extracted.verification_status });
      }
    }

    if (unverified.length > 0) {
      return res.status(400).json({
        message: "Application cannot be submitted. Some documents have not been processed for verification yet.",
        missing_verification: unverified,
        instruction: "Please call the respective summary/details API for these documents first."
      });
    }

    if (suspicious.length > 0) {
      return res.status(400).json({
        message: "One or more documents failed authenticity verification.",
        flagged_documents: suspicious,
      });
    }

    // ── All checks passed ────────────────────────────────────────────────────
    const submittedDocs = REQUIRED_DOCS.map((type) => ({
      type,
      file_id: docMap[type]._id,
      verification_status: docMap[type].extractedData?.verification_status || "pending",
      authenticity_score: docMap[type].extractedData?.authenticity_score || null,
    }));

    return res.status(200).json({
      message: "Application submitted successfully",
      submitted_at: new Date().toISOString(),
      applicant: {
        id: req.user._id,
        name: req.user.fullName,
        email: req.user.email,
      },
      submitted_documents: submittedDocs,
    });
  } catch (error) {
    console.error("Error in submitApplication:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
