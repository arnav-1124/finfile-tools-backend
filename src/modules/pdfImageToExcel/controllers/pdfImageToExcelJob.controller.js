import {
  readPdfImageToExcelJob,
  startPdfImageToExcelJob,
} from "../services/pdfImageToExcelJob.service.js";

export function createPdfImageToExcelJobController(req, res, next) {
  try {
    const job = startPdfImageToExcelJob({
      files: req.files || [],
      extractionMode: req.body?.extractionMode,
    });

    res.status(202).json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
    });
  } catch (error) {
    next(error);
  }
}

export function getPdfImageToExcelJobController(req, res, next) {
  try {
    const job = readPdfImageToExcelJob(req.params.jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "Extraction job not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    next(error);
  }
}
