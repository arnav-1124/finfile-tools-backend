import { parseDocumentFile } from "../services/documentParser.service.js";
import {
  createDocumentParserJob,
  getDocumentParserJob,
  toDocumentParserJobResult,
  toSafeDocumentParserJob,
} from "../services/documentParserJobStore.service.js";
import { runDocumentParserJob } from "../services/documentParserJob.service.js";

export async function parseDocumentController(req, res, next) {
  try {
    const result = await parseDocumentFile({
      file: req.file,
      parserMode: req.body?.parserMode || "AUTO",
      qualityMode: req.body?.qualityMode || "BALANCED",
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createDocumentParserJobController(req, res, next) {
  try {
    if (!req.file) {
      const error = new Error("File is required for document parsing.");
      error.statusCode = 400;
      throw error;
    }

    const job = createDocumentParserJob({
      file: req.file,
      parserMode: req.body?.parserMode || "AUTO",
      qualityMode: req.body?.qualityMode || "BALANCED",
    });

    runDocumentParserJob(job);

    res.status(202).json({
      success: true,
      message: "Document parsing job started.",
      job: toSafeDocumentParserJob(job),
    });
  } catch (error) {
    next(error);
  }
}

export async function getDocumentParserJobController(req, res, next) {
  try {
    const job = getDocumentParserJob(req.params.jobId);

    if (!job) {
      const error = new Error("Document parsing job not found.");
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      job: toSafeDocumentParserJob(job),
    });
  } catch (error) {
    next(error);
  }
}

export async function getDocumentParserJobResultController(req, res, next) {
  try {
    const job = getDocumentParserJob(req.params.jobId);

    if (!job) {
      const error = new Error("Document parsing job not found.");
      error.statusCode = 404;
      throw error;
    }

    if (job.status !== "COMPLETED" || !job.result) {
      const error = new Error("Document parsing result is not ready yet.");
      error.statusCode = 409;
      throw error;
    }

    res.json({
      success: true,
      result: toDocumentParserJobResult(job),
    });
  } catch (error) {
    next(error);
  }
}
