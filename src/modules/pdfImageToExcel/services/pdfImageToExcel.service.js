import {
  createJobId,
  uploadTempFileToStorage,
} from "../../files/fileStorage.service.js";
import { validatePdfImageUploadFiles } from "../../files/fileValidation.service.js";
import { runPdfImageToExcelEngine } from "./documentEngineBridge.service.js";

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

  const selectedExtractionMode = extractionMode || "FAST_TABLE";

  const engineResult = await runPdfImageToExcelEngine({
    files,
    extractionMode: selectedExtractionMode,
  });

  return {
    success: true,
    jobId,
    status: "preview-ready",
    extractionMode: selectedExtractionMode,
    filesProcessed: uploadedFiles.length,
    uploadedFiles,
    previewTable: {
      columns: engineResult.columns || [],
      rows: engineResult.rows || [],
      totalRows: engineResult.totalRows || 0,
      previewLimit: engineResult.previewLimit || 25,
      editedCells: {},
    },
    engine: {
      version: engineResult.engineVersion,
      extractionStrategy: engineResult.extractionStrategy,
      confidence: engineResult.confidence,
    },
    warnings: engineResult.warnings || [],
  };
}
