import express from "express";

import { uploadMemory } from "../../../shared/middleware/uploadMemory.middleware.js";

import { extractPdfImageToExcelController } from "../controllers/pdfImageToExcel.controller.js";
import {
  createPdfImageToExcelJobController,
  getPdfImageToExcelJobController,
} from "../controllers/pdfImageToExcelJob.controller.js";

const router = express.Router();

router.post(
  "/extract",
  uploadMemory.array("files", 10),
  extractPdfImageToExcelController,
);

router.post(
  "/jobs",
  uploadMemory.array("files", 10),
  createPdfImageToExcelJobController,
);

router.get("/jobs/:jobId", getPdfImageToExcelJobController);

export default router;
