export const PDF_UTILITY_LIMITS = {
  singlePdfMaxBytes: 50 * 1024 * 1024,
  splitMaxPages: 200,

  mergeMaxFiles: 50,
  mergeSinglePdfMaxBytes: 20 * 1024 * 1024,
  mergeTotalMaxBytes: 100 * 1024 * 1024,

  rotatePdfMaxBytes: 50 * 1024 * 1024,
  rotatePdfMaxPages: 200,
  rotateImageMaxBytes: 15 * 1024 * 1024,

  imagesToPdfMaxFiles: 50,
  imagesToPdfSingleImageMaxBytes: 15 * 1024 * 1024,
  imagesToPdfTotalMaxBytes: 100 * 1024 * 1024,
};

export function formatLimitMb(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

export function getTotalFileSize(files = []) {
  return files.reduce((total, file) => total + file.size, 0);
}
