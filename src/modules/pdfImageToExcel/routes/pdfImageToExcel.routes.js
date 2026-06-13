import express from "express";

import { uploadMemory } from "../../../shared/middleware/uploadMemory.middleware.js";
import { extractPdfImageToExcelController } from "../controllers/pdfImageToExcel.controller.js";

const router = express.Router();

router.post(
  "/extract",
  uploadMemory.array("files", 10),
  extractPdfImageToExcelController,
);

export default router;
