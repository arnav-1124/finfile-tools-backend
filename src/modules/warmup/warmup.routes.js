import { Router } from "express";

import { warmupController } from "./warmup.controller.js";

const router = Router();

router.get("/", warmupController);

export default router;
