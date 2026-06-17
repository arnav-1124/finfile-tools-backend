import { callDocumentEngineParser } from "./documentEngineParserClient.service.js";
import { updateDocumentParserJob } from "./documentParserJobStore.service.js";

function buildPayloadFromJob(job) {
  return {
    jobId: job.jobId,
    parserMode: job.parserMode,
    qualityMode: job.qualityMode,
    files: [
      {
        originalName: job.file.originalName,
        mimeType: job.file.mimeType,
        sizeBytes: job.file.sizeBytes,
        contentBase64: job.file.buffer.toString("base64"),
      },
    ],
  };
}

export function runDocumentParserJob(job) {
  setImmediate(async () => {
    try {
      updateDocumentParserJob(job.jobId, {
        status: "PROCESSING",
        progress: {
          percent: 8,
          stage: "Preparing",
          message: "Preparing document for parsing.",
        },
      });

      const progressInterval = setInterval(() => {
        const currentStages = [
          {
            percent: 18,
            stage: "Analyzing",
            message: "Checking document type and embedded text.",
          },
          {
            percent: 32,
            stage: "Rendering",
            message: "Preparing document pages for OCR.",
          },
          {
            percent: 48,
            stage: "Scanning",
            message: "Running OCR on document pages.",
          },
          {
            percent: 64,
            stage: "Extracting",
            message: "Extracting readable text blocks.",
          },
          {
            percent: 78,
            stage: "Structuring",
            message: "Organizing extracted output.",
          },
          {
            percent: 88,
            stage: "Finalizing",
            message: "Finalizing parsed document result.",
          },
        ];

        const randomStage =
          currentStages[Math.floor(Math.random() * currentStages.length)];

        updateDocumentParserJob(job.jobId, {
          progress: randomStage,
        });
      }, 12000);

      const result = await callDocumentEngineParser(buildPayloadFromJob(job));

      clearInterval(progressInterval);

      updateDocumentParserJob(job.jobId, {
        status: "COMPLETED",
        progress: {
          percent: 100,
          stage: "Completed",
          message: "Document parsing is complete.",
        },
        result,
      });
    } catch (error) {
      updateDocumentParserJob(job.jobId, {
        status: "FAILED",
        progress: {
          percent: 100,
          stage: "Failed",
          message:
            error.message ||
            "Document parsing failed. Please try another file.",
        },
        error: {
          message:
            error.message ||
            "Document parsing failed. Please try another file.",
          statusCode: error.statusCode || 500,
        },
      });
    }
  });
}
