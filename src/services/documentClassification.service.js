import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const ALLOWED_TYPES = [
  "passport",
  "pancard",
  "marksheet",
  "statement_of_purpose",
  "recommendation_letter",
  "unknown",
];

function cleanGeminiJson(raw) {
  let s = (raw || "").trim();

  if (s.startsWith("```")) {
    // remove starting ```json or ``` fence
    s = s.replace(/^```json/i, "").replace(/^```/i, "");
    // remove trailing ```
    s = s.replace(/```$/i, "").trim();
  }

  return s;
}

async function extractTextFromBuffer(buffer, mimeType) {
  if (!buffer) {
    throw new Error("File buffer is missing");
  }

  if (!mimeType) {
    throw new Error("mimeType is missing");
  }

  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || "";
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  }

  throw new Error(`Unsupported mimeType for text extraction: ${mimeType}`);
}

const buildClassifierInstructions = () => `
You are a document classifier. 
You must classify the given document content into exactly one of these types:
- passport
- pancard
- marksheet
- statement_of_purpose
- recommendation_letter
- unknown

Return ONLY the type string, nothing else.
`;

async function normalizeGeminiResultToType(response) {
  const raw =
    typeof response.text === "function"
      ? response.text()
      : String(response.text || "");

  const normalized = raw.trim().toLowerCase();

  if (ALLOWED_TYPES.includes(normalized)) {
    return normalized;
  }

  return "unknown";
}

async function classifyTextWithGemini(text) {
  if (!text || !text.trim()) {
    return "unknown";
  }

  const prompt = `
${buildClassifierInstructions()}

Document content:
${text.slice(0, 6000)}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  return await normalizeGeminiResultToType(response);
}

async function classifyImageWithGemini(buffer, mimeType) {
  if (!buffer) {
    return "unknown";
  }

  const instructions = `${buildClassifierInstructions()}

Classify the document shown in the image.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: instructions },
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
            },
          },
        ],
      },
    ],
  });

  return await normalizeGeminiResultToType(response);
}

export async function classifyAndUpdateDocumentType(fileDoc) {
  if (!fileDoc) {
    throw new Error("fileDoc is required");
  }

  try {
    const { data, mimeType } = fileDoc;

    let documentType = "unknown";

    if (mimeType === "application/pdf") {
      const text = await extractTextFromBuffer(data, mimeType);
      documentType = await classifyTextWithGemini(text);
    } else if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const text = await extractTextFromBuffer(data, mimeType);
      documentType = await classifyTextWithGemini(text);
    } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      documentType = await classifyImageWithGemini(data, mimeType);
    } else {
      documentType = "unknown";
    }

    fileDoc.documentType = documentType;
    await fileDoc.save();

    return documentType;
  } catch (error) {
    console.error("Error in classifyAndUpdateDocumentType:", error);
    throw error;
  }
}

const MARKSHEET_INFO_PROMPT = (text) => `
You are an AI system responsible for verifying and extracting information from student academic marksheets or grade reports.

The document provided is expected to be a university or college marksheet.
Your task is to carefully analyze the document and extract structured information.

Tasks:

1. Determine if the document is a valid academic marksheet or grade report.
2. Extract the following information if present:

   * student_name
   * university_name
   * institute_name
   * program          (e.g. "B.Tech Computer Science")
   * enrollment_number
   * seat_number
   * academic_year    (e.g. "2023-24")
   * semester         (e.g. "Semester 3")
   * sgpa             (Semester Grade Point Average)
   * cgpa             (Cumulative Grade Point Average, if available)
   * total_credits
   * backlog          (number of backlogs / failed subjects, if any)
   * result_status    (e.g. "PASS", "FAIL", "ATKT")

3. Extract a list of subjects with:

   * subject_code
   * subject_name
   * credit
   * grade
   * grade_point

4. Assess the student's academic performance:

   * overall_performance  (e.g. "Excellent", "Good", "Average", "Poor")
   * strengths            (list of subjects where the student performed best)
   * areas_of_improvement (list of subjects with low grades or failures)

5. Verify if the document appears authentic by checking:

   * Presence of university name and official seal/stamp description
   * Presence of a complete subject table with grades
   * Presence of SGPA or CGPA values
   * Consistency of grades and grade points

6. Provide a verification status:

   * "verified"   — all key fields present and data is internally consistent
   * "suspicious" — some fields missing or data appears inconsistent
   * "invalid"    — document does not appear to be a marksheet

7. Provide a short human-readable summary (2-3 sentences).

Return ONLY valid JSON in the following structure:

{
  "document_type": "marksheet",
  "verification_status": "",
  "student_name": "",
  "university_name": "",
  "institute_name": "",
  "program": "",
  "enrollment_number": "",
  "seat_number": "",
  "academic_year": "",
  "semester": "",
  "sgpa": "",
  "cgpa": "",
  "total_credits": "",
  "backlog": "",
  "result_status": "",
  "overall_performance": "",
  "strengths": [],
  "areas_of_improvement": [],
  "subjects": [
    {
      "subject_code": "",
      "subject_name": "",
      "credit": "",
      "grade": "",
      "grade_point": ""
    }
  ],
  "authenticity_score": "",
  "summary": ""
}

Document text / image content:

${text}
`;

export async function extractMarksheetInfoFromFile(fileDoc) {
  if (!fileDoc) {
    throw new Error("fileDoc is required");
  }

  const { data, mimeType, documentType } = fileDoc;

  if (documentType && documentType !== "marksheet") {
    throw new Error("File documentType is not marksheet");
  }

  let response;

  // PDF / DOCX: extract text first
  if (
    mimeType === "application/pdf" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const text = await extractTextFromBuffer(data, mimeType);

    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: MARKSHEET_INFO_PROMPT(text) }],
        },
      ],
    });
  } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    // JPEG: send image directly to Gemini (no OCR needed)
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: MARKSHEET_INFO_PROMPT("<<image>>") },
            {
              inlineData: {
                data: data.toString("base64"),
                mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
              },
            },
          ],
        },
      ],
    });
  } else {
    throw new Error(`Unsupported mimeType for marksheet extraction: ${mimeType}`);
  }

  const raw =
    typeof response.text === "function"
      ? response.text()
      : String(response.text || "");

  const cleaned = cleanGeminiJson(raw);
  return JSON.parse(cleaned);
}


const SOP_SUMMARY_PROMPT = (text) => `
You are an expert AI assistant that deeply analyzes Statements of Purpose (SOP) written for study abroad or higher education applications.

Given the SOP text, your tasks are:

1. Identify applicant details if mentioned:

   * applicant_name         (full name of the applicant, if stated)
   * target_program         (the course or program they are applying for)
   * target_university      (the university or institution they are applying to, if mentioned)
   * target_country         (country of intended study, if mentioned)

2. Analyze the SOP content:

   * word_count             (estimated word count of the SOP)
   * main_topics            (list of key themes or topics discussed, as short phrases)
   * strengths              (list of strong points — compelling arguments, unique experiences, clear goals)
   * areas_of_improvement   (list of weak points — vague statements, missing motivations, repetition)
   * tone                   (e.g. "Professional", "Passionate", "Formal", "Casual", "Persuasive")
   * clarity_score          ("High", "Medium", or "Low" — how clearly the applicant communicates their goals)

3. Evaluate if the SOP meets general standards for study abroad applications:

   * verification_status    ("verified" if it reads as a genuine SOP, "suspicious" if it seems auto-generated or plagiarized, "invalid" if it is not an SOP)
   * authenticity_score     ("High", "Medium", or "Low")

4. Write a concise human-readable summary (2-3 sentences) of the SOP.

Return ONLY valid JSON in the following structure:

{
  "document_type": "statement_of_purpose",
  "verification_status": "",
  "applicant_name": "",
  "target_program": "",
  "target_university": "",
  "target_country": "",
  "word_count": 0,
  "main_topics": [],
  "strengths": [],
  "areas_of_improvement": [],
  "tone": "",
  "clarity_score": "",
  "authenticity_score": "",
  "summary": ""
}

SOP text:

${text}
`;

export async function summarizeSopFromFile(fileDoc) {
  if (!fileDoc) {
    throw new Error("fileDoc is required");
  }

  const { data, mimeType, documentType } = fileDoc;

  // Optional: enforce that this is classified as SOP
  if (documentType && documentType !== "statement_of_purpose") {
    throw new Error("File documentType is not statement_of_purpose");
  }

  if (
    mimeType !== "application/pdf" &&
    mimeType !==
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    throw new Error(`Unsupported mimeType for SOP summary: ${mimeType}`);
  }

  const text = await extractTextFromBuffer(data, mimeType);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: SOP_SUMMARY_PROMPT(text) }],
      },
    ],
  });

  const raw =
    typeof response.text === "function"
      ? response.text()
      : String(response.text || "");

  const cleaned = cleanGeminiJson(raw);
  return JSON.parse(cleaned);
}



const PANCARD_SUMMARY_PROMPT = (text) => `
You are an AI system responsible for verifying and extracting information from Indian PAN (Permanent Account Number) cards.

The document provided is expected to be a PAN card issued by the Income Tax Department of India.
Your task is to analyze the document and extract structured information.

Tasks:

1. Determine if the document is a valid Indian PAN card.
2. Extract the following information if present:

   * pan_number         (10-character alphanumeric, e.g. ABCDE1234F)
   * name               (name of the card holder as printed)
   * father_name        (father's name as printed)
   * date_of_birth      (in DD/MM/YYYY format as printed)
   * gender             (if determinable from the document)
   * issuing_authority  (e.g. "Income Tax Department, Govt. of India")

3. Verify if the document appears authentic by checking:

   * Presence of a valid 10-character PAN number in the standard format (5 letters + 4 digits + 1 letter)
   * Presence of holder name and father's name
   * Presence of date of birth
   * Presence of the Income Tax Department branding / logo description

4. Provide a verification status:

   * "verified"   — all key fields present and PAN format is valid
   * "suspicious" — some fields missing or PAN format looks incorrect
   * "invalid"    — document does not appear to be a PAN card

5. Provide a short human-readable summary of the card (2-3 sentences).

Return ONLY valid JSON in the following structure:

{
  "document_type": "pancard",
  "verification_status": "",
  "pan_number": "",
  "name": "",
  "father_name": "",
  "date_of_birth": "",
  "gender": "",
  "issuing_authority": "",
  "authenticity_score": "",
  "summary": ""
}

Document text / image content:

${text}
`;

export async function extractPancardInfoFromFile(fileDoc) {
  if (!fileDoc) {
    throw new Error("fileDoc is required");
  }

  const { data, mimeType, documentType } = fileDoc;

  if (documentType && documentType !== "pancard") {
    throw new Error("File documentType is not pancard");
  }

  let response;

  // PDF / DOCX: extract text first, then send to Gemini
  if (
    mimeType === "application/pdf" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const text = await extractTextFromBuffer(data, mimeType);

    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: PANCARD_SUMMARY_PROMPT(text) }],
        },
      ],
    });
  } else if (
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    mimeType === "image/png"
  ) {
    // Image: send directly to Gemini (vision)
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: PANCARD_SUMMARY_PROMPT("<<image>>") },
            {
              inlineData: {
                data: data.toString("base64"),
                mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
              },
            },
          ],
        },
      ],
    });
  } else {
    throw new Error(
      `Unsupported mimeType for PAN card extraction: ${mimeType}`
    );
  }

  const raw =
    typeof response.text === "function"
      ? response.text()
      : String(response.text || "");

  const cleaned = cleanGeminiJson(raw);
  return JSON.parse(cleaned);
}

const SOP_IMPROVEMENT_PROMPT = (text) => `
You are an elite Study Abroad Consultant and SOP Editor. 
Analyze the following Statement of Purpose (SOP) and provide a professional critique and three alternative improved formats.

Tasks:
1. Identify MISSING critical elements (e.g., missing motivation, lack of research on university, weak career goals).
2. Compare the CURRENT content with IDEAL standards.
3. Suggest Three targetted formats:
   - Format 1: "The Storyteller" (Narrative-driven, focus on personal journey)
   - Format 2: "The Professional" (Achievement-driven, focus on work exp and skills)
   - Format 3: "The Academic" (Research-driven, focus on thesis and academic contribution)

Return ONLY valid JSON:
{
  "current_analysis": {
    "strengths": [],
    "weaknesses": [],
    "missing_elements": [],
    "impact_score": "out of 100"
  },
  "comparison": {
    "structure": "Comparison of current vs suggested structure",
    "tone": "Critique of current tone vs ideal tone",
    "clarity": "How to improve clarity"
  },
  "suggested_formats": [
    {
      "name": "The Storyteller",
      "focus": "Personal journey and internal motivation",
      "structure": ["Intro: The Hook", "Body: Life-changing experiences", "Conclusion: Future Vision"],
      "sample_outline": "Detailed outline..."
    },
    {
      "name": "The Professional",
      "focus": "Professional milestones and industry readiness",
      "structure": ["Intro: Current Expertise", "Body: Projects and impact", "Conclusion: Role of this degree"],
      "sample_outline": "Detailed outline..."
    },
    {
      "name": "The Academic",
      "focus": "Research interests and scholarly potential",
      "structure": ["Intro: Academic Query", "Body: Research work", "Conclusion: Contribution to faculty"],
      "sample_outline": "Detailed outline..."
    }
  ],
  "overall_suggestions": ""
}

SOP Content:
${text}
`;

export async function analyzeAndSuggestSop(fileDoc) {
  if (!fileDoc) throw new Error("fileDoc is required");
  const { data, mimeType, documentType } = fileDoc;

  if (documentType && documentType !== "statement_of_purpose") {
    throw new Error("File is not classified as SOP. Please classify it first.");
  }

  const text = await extractTextFromBuffer(data, mimeType);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: SOP_IMPROVEMENT_PROMPT(text) }] }],
  });

  const raw = typeof response.text === "function" ? response.text() : String(response.text || "");
  const cleaned = cleanGeminiJson(raw);
  return JSON.parse(cleaned);
}
