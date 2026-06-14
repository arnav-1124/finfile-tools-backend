import {
  createJobId,
  uploadTempFileToStorage,
} from "../../files/fileStorage.service.js";
import { validatePdfImageUploadFiles } from "../../files/fileValidation.service.js";
import { runPdfImageToExcelEngine } from "./documentEngineBridge.service.js";

function getElapsedMs(startTime) {
  return Math.round(performance.now() - startTime);
}

export async function extractPdfImageToExcel({ files = [], extractionMode }) {
  const requestStartTime = performance.now();

  const validation = validatePdfImageUploadFiles(files);

  if (!validation.isValid) {
    const error = new Error(validation.message);
    error.statusCode = 400;
    throw error;
  }

  const jobId = createJobId();
  const uploadedFiles = [];

  const uploadStartTime = performance.now();

  for (const file of files) {
    const uploadedFile = await uploadTempFileToStorage({
      jobId,
      file,
    });

    uploadedFiles.push(uploadedFile);
  }

  const uploadMs = getElapsedMs(uploadStartTime);

  const selectedExtractionMode = extractionMode || "FAST_TABLE";

  const engineStartTime = performance.now();

  const engineResult = await runPdfImageToExcelEngine({
    files,
    extractionMode: selectedExtractionMode,
  });

  const engineMs = getElapsedMs(engineStartTime);
  const totalMs = getElapsedMs(requestStartTime);

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
      metadata: engineResult.metadata || {},
      performance: engineResult.performance || {},
    },
    performance: {
      uploadMs,
      engineMs,
      totalMs,
    },
    warnings: engineResult.warnings || [],
  };
}
