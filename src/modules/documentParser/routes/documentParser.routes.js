import { Router } from "express";

import { uploadMemory } from "../../../shared/middleware/uploadMemory.middleware.js";
import { parseDocumentController } from "../controllers/documentParser.controller.js";

const router = Router();

router.post("/parse", uploadMemory.single("file"), parseDocumentController);

export default router;
