import { Router } from "express";

import { uploadMemory } from "../../../shared/middleware/uploadMemory.middleware.js";
import {
  createDocumentParserJobController,
  getDocumentParserJobController,
  parseDocumentController,
} from "../controllers/documentParser.controller.js";

const router = Router();

router.post("/parse", uploadMemory.single("file"), parseDocumentController);

router.post(
  "/jobs",
  uploadMemory.single("file"),
  createDocumentParserJobController,
);

router.get("/jobs/:jobId", getDocumentParserJobController);

export default router;
