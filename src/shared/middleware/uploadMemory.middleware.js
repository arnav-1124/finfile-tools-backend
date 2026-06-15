import multer from "multer";

const MAX_MEMORY_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_MEMORY_UPLOAD_FILES = 50;

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_MEMORY_UPLOAD_FILES,
    fileSize: MAX_MEMORY_UPLOAD_SIZE_BYTES,
  },
});
