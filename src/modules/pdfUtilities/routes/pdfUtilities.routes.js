import express from "express";

import { uploadMemory } from "../../../shared/middleware/uploadMemory.middleware.js";

import {
  mergePdfController,
  rotatePdfController,
  splitPdfController,
} from "../controllers/pdfUtilities.controller.js";

const router = express.Router();

router.post("/split", uploadMemory.single("file"), splitPdfController);
router.post("/merge", uploadMemory.array("files", 20), mergePdfController);
router.post("/rotate", uploadMemory.single("file"), rotatePdfController);

export default router;
