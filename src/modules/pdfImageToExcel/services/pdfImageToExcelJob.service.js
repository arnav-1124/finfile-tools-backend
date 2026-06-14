import { extractPdfImageToExcel } from "./pdfImageToExcel.service.js";
import {
  createPdfImageToExcelJob,
  getPdfImageToExcelJob,
  updatePdfImageToExcelJob,
} from "./pdfImageToExcelJobStore.service.js";

function scheduleProgress(jobId) {
  const steps = [
    {
      progress: 18,
      currentStep: "Uploading files to secure storage",
      delay: 400,
    },
    {
      progress: 35,
      currentStep: "Preparing document structure",
      delay: 900,
    },
    {
      progress: 58,
      currentStep: "Running OCR and table extraction",
      delay: 1400,
    },
    {
      progress: 78,
      currentStep: "Building preview table",
      delay: 2200,
    },
    {
      progress: 92,
      currentStep: "Checking confidence and warnings",
      delay: 3200,
    },
  ];

  const timers = steps.map((step) =>
    setTimeout(() => {
      const job = getPdfImageToExcelJob(jobId);

      if (!job || job.status !== "processing") return;

      updatePdfImageToExcelJob(jobId, {
        progress: step.progress,
        currentStep: step.currentStep,
      });
    }, step.delay),
  );

  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
}

export function startPdfImageToExcelJob({ files = [], extractionMode }) {
  const job = createPdfImageToExcelJob({
    fileCount: files.length,
    extractionMode: extractionMode || "FAST_TABLE",
  });

  updatePdfImageToExcelJob(job.jobId, {
    status: "processing",
    progress: 10,
    currentStep: "Starting extraction",
  });

  const stopProgress = scheduleProgress(job.jobId);

  setImmediate(async () => {
    try {
      const result = await extractPdfImageToExcel({
        files,
        extractionMode,
        jobIdOverride: job.jobId,
      });

      stopProgress();

      updatePdfImageToExcelJob(job.jobId, {
        status: "completed",
        progress: 100,
        currentStep: "Preview ready",
        result,
      });
    } catch (error) {
      stopProgress();

      updatePdfImageToExcelJob(job.jobId, {
        status: "failed",
        progress: 0,
        currentStep: "Extraction failed",
        error: error.message || "Extraction failed.",
      });
    }
  });

  return job;
}

export function readPdfImageToExcelJob(jobId) {
  return getPdfImageToExcelJob(jobId);
}
