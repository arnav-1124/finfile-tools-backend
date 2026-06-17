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

      const estimatedStages = [
        {
          percent: 18,
          stage: "Analyzing",
          message: "Checking document type and embedded text.",
        },
        {
          percent: 32,
          stage: "Preparing pages",
          message: "Preparing document pages for OCR.",
        },
        {
          percent: 48,
          stage: "Scanning",
          message:
            "Running OCR on document pages. Dense scanned pages can take longer.",
        },
        {
          percent: 62,
          stage: "Reading text",
          message: "Extracting readable text blocks from the document.",
        },
        {
          percent: 74,
          stage: "Structuring",
          message: "Organizing extracted text into usable output.",
        },
        {
          percent: 86,
          stage: "Finalizing",
          message: "Finalizing parsed document result.",
        },
        {
          percent: 94,
          stage: "Almost done",
          message: "Finishing OCR output. Please keep this tab open.",
        },
      ];

      let progressIndex = 0;

      const progressInterval = setInterval(() => {
        if (progressIndex >= estimatedStages.length) {
          return;
        }

        updateDocumentParserJob(job.jobId, {
          progress: estimatedStages[progressIndex],
        });

        progressIndex += 1;
      }, 30000);

      const asyncTimeoutMs = Number(
        process.env.DOCUMENT_PARSER_ASYNC_TIMEOUT_MS || 900000,
      );

      const result = await callDocumentEngineParser(buildPayloadFromJob(job), {
        timeoutMs: asyncTimeoutMs,
        timeoutMessage:
          "This document is still taking longer than expected. Heavy scanned PDFs may need high-accuracy background processing.",
      });

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
