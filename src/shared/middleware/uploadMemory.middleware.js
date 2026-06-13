import multer from "multer";

import { GUEST_UPLOAD_LIMITS } from "../../modules/files/fileValidation.service.js";

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: GUEST_UPLOAD_LIMITS.maxFiles,
    fileSize: GUEST_UPLOAD_LIMITS.maxFileSizeBytes,
  },
});
