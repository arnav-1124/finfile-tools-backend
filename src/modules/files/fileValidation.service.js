const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

export const GUEST_UPLOAD_LIMITS = {
  maxFiles: 10,
  maxFileSizeBytes: 10 * 1024 * 1024,
};

export function getFileExtension(fileName = "") {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";

  return fileName.slice(lastDotIndex).toLowerCase();
}

export function validatePdfImageUploadFiles(files = []) {
  if (!files.length) {
    return {
      isValid: false,
      message: "At least one file is required.",
    };
  }

  if (files.length > GUEST_UPLOAD_LIMITS.maxFiles) {
    return {
      isValid: false,
      message: `You can upload up to ${GUEST_UPLOAD_LIMITS.maxFiles} files at once.`,
    };
  }

  for (const file of files) {
    const extension = getFileExtension(file.originalname);

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return {
        isValid: false,
        message: "Only PDF, PNG, JPG, and JPEG files are allowed.",
      };
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return {
        isValid: false,
        message: "Unsupported file type detected.",
      };
    }

    if (file.size > GUEST_UPLOAD_LIMITS.maxFileSizeBytes) {
      return {
        isValid: false,
        message: "Each file must be 10 MB or smaller for guest users.",
      };
    }
  }

  return {
    isValid: true,
    message: null,
  };
}
