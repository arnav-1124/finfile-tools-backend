import {
  createJobId,
  uploadTempFileToStorage,
} from "../../files/fileStorage.service.js";
import { validatePdfImageUploadFiles } from "../../files/fileValidation.service.js";

export async function extractPdfImageToExcel({ files = [], extractionMode }) {
  const validation = validatePdfImageUploadFiles(files);

  if (!validation.isValid) {
    const error = new Error(validation.message);
    error.statusCode = 400;
    throw error;
  }

  const jobId = createJobId();

  const uploadedFiles = [];

  for (const file of files) {
    const uploadedFile = await uploadTempFileToStorage({
      jobId,
      file,
    });

    uploadedFiles.push(uploadedFile);
  }

  return {
    success: true,
    jobId,
    status: "preview-ready",
    extractionMode: extractionMode || "FAST_TABLE",
    filesProcessed: uploadedFiles.length,
    uploadedFiles,
    previewTable: {
      columns: ["Column 1", "Column 2", "Column 3", "Column 4"],
      rows: [
        ["Storage upload", "Supabase private bucket", "Connected", "High"],
        ["Files received", `${uploadedFiles.length}`, "Validated", "High"],
        ["OCR engine", "Pending Python bridge", "Next step", "Medium"],
      ],
      totalRows: 3,
      previewLimit: 25,
      editedCells: {},
    },
    warnings: [
      "This response confirms backend upload and storage. OCR extraction will be connected through the Python document-engine next.",
    ],
  };
}
