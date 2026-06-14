import crypto from "node:crypto";

const jobs = new Map();

export function createPdfImageToExcelJob({ fileCount, extractionMode }) {
  const jobId = `job_${crypto.randomUUID()}`;

  const job = {
    jobId,
    status: "queued",
    progress: 5,
    currentStep: "Queued for extraction",
    fileCount,
    extractionMode,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);

  return job;
}

export function getPdfImageToExcelJob(jobId) {
  return jobs.get(jobId) || null;
}

export function updatePdfImageToExcelJob(jobId, updates) {
  const existingJob = jobs.get(jobId);

  if (!existingJob) return null;

  const updatedJob = {
    ...existingJob,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, updatedJob);

  return updatedJob;
}
