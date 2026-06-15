import express from "express";

import { uploadMemory } from "../../../shared/middleware/uploadMemory.middleware.js";

import {
  addPdfPageNumbersController,
  imagesToPdfController,
  mergePdfController,
  pdfToImagesController,
  removePdfPagesController,
  rotatePdfController,
  splitPdfController,
} from "../controllers/pdfUtilities.controller.js";

const router = express.Router();

router.post("/split", uploadMemory.single("file"), splitPdfController);
router.post("/merge", uploadMemory.array("files", 20), mergePdfController);
router.post("/rotate", uploadMemory.single("file"), rotatePdfController);
router.post(
  "/images-to-pdf",
  uploadMemory.array("files", 30),
  imagesToPdfController,
);
router.post(
  "/pdf-to-images",
  uploadMemory.single("file"),
  pdfToImagesController,
);
router.post(
  "/remove-pages",
  uploadMemory.single("file"),
  removePdfPagesController,
);
router.post(
  "/page-numbers",
  uploadMemory.single("file"),
  addPdfPageNumbersController,
);

export default router;
