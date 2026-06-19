const jobs = new Map();

export function createDocumentParserJob({ parserMode, qualityMode, file }) {
  const jobId = `doc_parse_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const now = new Date().toISOString();

  const job = {
    jobId,
    status: "QUEUED",
    progress: {
      percent: 0,
      stage: "Queued",
      message: "Document parsing job has been queued.",
    },
    parserMode,
    qualityMode,
    file: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      buffer: file.buffer,
    },
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(jobId, job);

  return job;
}

export function getDocumentParserJob(jobId) {
  return jobs.get(jobId) || null;
}

export function updateDocumentParserJob(jobId, patch) {
  const existingJob = getDocumentParserJob(jobId);

  if (!existingJob) {
    return null;
  }

  const updatedJob = {
    ...existingJob,
    ...patch,
    progress: {
      ...existingJob.progress,
      ...(patch.progress || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, updatedJob);

  return updatedJob;
}

function getResultSummary(result) {
  if (!result) {
    return null;
  }

  const tables = result.outputs?.tables || [];
  const plainText = result.outputs?.plainText || "";
  const markdown = result.outputs?.markdown || "";

  return {
    success: result.success,
    jobId: result.jobId,
    parserMode: result.parserMode,
    selectedParser: result.selectedParser,
    status: result.status,
    document: result.document,
    confidence: result.confidence,
    warnings: result.warnings || [],
    engine: result.engine,
    performance: result.performance,
    outputSummary: {
      hasPlainText: Boolean(plainText),
      hasMarkdown: Boolean(markdown),
      tableCount: tables.length,
      plainTextLength: plainText.length,
      markdownLength: markdown.length,
    },
  };
}

export function toSafeDocumentParserJob(job) {
  if (!job) {
    return null;
  }

  return {
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    parserMode: job.parserMode,
    qualityMode: job.qualityMode,
    file: {
      originalName: job.file?.originalName,
      mimeType: job.file?.mimeType,
      sizeBytes: job.file?.sizeBytes,
    },
    result: getResultSummary(job.result),
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function toDocumentParserJobResult(job) {
  if (!job) {
    return null;
  }

  if (!job.result) {
    return null;
  }

  return job.result;
}
