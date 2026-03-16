# KananHack Server — API Documentation

Base URL: `http://localhost:3000`

All protected routes require the header:
```
Authorization: Bearer <token>
```

---

## Health

### GET `/health`
Returns server status.

**Response `200`**
```json
{ "message": "Server is running" }
```

---

## Auth — `/api/auth`

### POST `/api/auth/register`
Register a new user.

**Body**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "secret123"
}
```

**Response `201`**
```json
{
  "message": "User registered successfully",
  "user": { "id": "<id>", "fullName": "John Doe", "email": "john@example.com" },
  "token": "<jwt>"
}
```

**Errors**
| Status | Message |
|--------|---------|
| 400 | Full name, email and password are required |
| 409 | Email is already registered |

---

### POST `/api/auth/login`
Login with existing credentials.

**Body**
```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

**Response `200`**
```json
{
  "message": "Logged in successfully",
  "user": { "id": "<id>", "fullName": "John Doe", "email": "john@example.com" },
  "token": "<jwt>"
}
```

**Errors**
| Status | Message |
|--------|---------|
| 400 | Email and password are required |
| 401 | Invalid credentials |

---

## Files — `/api/files` 🔒

### POST `/api/files/upload`
Upload a single PDF / DOC / DOCX file (multipart/form-data).

**Form Field:** `file`

**Response `201`**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "id": "<id>",
    "originalName": "resume.pdf",
    "mimeType": "application/pdf",
    "size": 102400,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET `/api/files/`
Get all files belonging to the authenticated user.

**Response `200`**
```json
{
  "count": 2,
  "files": [
    { "_id": "<id>", "originalName": "doc.pdf", "mimeType": "application/pdf", "size": 1024, "createdAt": "..." }
  ]
}
```

---

### GET `/api/files/:id`
Download a file by ID. Returns the raw file binary with appropriate `Content-Type` and `Content-Disposition` headers.

**Errors**
| Status | Message |
|--------|---------|
| 404 | File not found |
| 403 | You are not allowed to access this file |

---

### DELETE `/api/files/:id`
Delete a file by ID.

**Response `200`**
```json
{ "message": "File deleted successfully" }
```

**Errors**
| Status | Message |
|--------|---------|
| 404 | File not found |
| 403 | You are not allowed to delete this file |

---

### POST `/api/files/:id/classify`
Classify the document type using AI and update the file record.

**Response `200`**
```json
{
  "message": "Document classified successfully",
  "documentType": "marksheet"
}
```

Possible `documentType` values: `pancard`, `marksheet`, `statement_of_purpose`, `unknown`

---

### POST `/api/files/:id/marksheet-details`
Extract detailed marksheet information via Gemini AI. Result is cached on the file document.

**Response `200`**
```json
{
  "student_name": "John Doe",
  "institution": "XYZ University",
  "grades": [...],
  "verification_status": "verified",
  "authenticity_score": 92
}
```

---

### POST `/api/files/:id/sop-summary`
Summarize a Statement of Purpose via Gemini AI. Result is cached on the file document.

**Response `200`**
```json
{
  "summary": "Applicant aims to pursue...",
  "verification_status": "verified",
  "authenticity_score": 88
}
```

---

### POST `/api/files/:id/sop-analysis`
AI-powered SOP analysis with improvement suggestions. File must already be classified as `statement_of_purpose`.

**Response `200`**
```json
{
  "strengths": [...],
  "weaknesses": [...],
  "suggestions": [...],
  "overall_score": 78
}
```

**Errors**
| Status | Message |
|--------|---------|
| 400 | Document must be classified as statement_of_purpose first. |

---

### POST `/api/files/:id/pancard-summary`
Extract PAN card details via Gemini AI. Result is cached on the file document.

**Response `200`**
```json
{
  "name": "JOHN DOE",
  "pan_number": "ABCDE1234F",
  "date_of_birth": "01/01/1990",
  "verification_status": "verified",
  "authenticity_score": 95
}
```

> **Note:** All AI endpoints return `429` with `{ "message": "Gemini quota exceeded. Please try again later." }` when the AI quota is exceeded.

---

## Application — `/api/application` 🔒

Required documents: `pancard`, `marksheet`, `statement_of_purpose`

### GET `/api/application/progress`
Returns uploaded docs, missing docs, and completion percentage.

**Response `200`**
```json
{
  "uploaded": ["pancard", "marksheet"],
  "missing": ["statement_of_purpose"],
  "completion": 67
}
```

---

### GET `/api/application/dashboard`
Full dashboard with per-document verification details.

**Response `200`**
```json
{
  "documents_uploaded": 2,
  "documents_required": 3,
  "completion_percentage": 67,
  "missing_documents": ["statement_of_purpose"],
  "documents": [
    {
      "type": "pancard",
      "file_id": "<id>",
      "original_name": "pan.pdf",
      "uploaded_at": "2024-01-01T00:00:00.000Z",
      "verification_status": "verified",
      "authenticity_score": 95,
      "summary": "..."
    }
  ]
}
```

---

### POST `/api/application/submit`
Submit the application. Blocked if any required document is missing, unverified, or flagged as suspicious/invalid.

**Response `200`**
```json
{
  "message": "Application submitted successfully",
  "submitted_at": "2024-01-01T00:00:00.000Z",
  "applicant": { "id": "<id>", "name": "John Doe", "email": "john@example.com" },
  "submitted_documents": [
    { "type": "pancard", "file_id": "<id>", "verification_status": "verified", "authenticity_score": 95 }
  ]
}
```

**Errors**
| Status | Message |
|--------|---------|
| 400 | Application incomplete. Please upload all required documents before submitting. |
| 400 | Some documents have not been processed for verification yet. |
| 400 | One or more documents failed authenticity verification. |

---

## Common Error Responses

| Status | Message |
|--------|---------|
| 401 | No token provided / Token missing / Invalid or expired token |
| 500 | Server error |
