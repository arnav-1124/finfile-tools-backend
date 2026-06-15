import { degrees, PDFDocument } from "pdf-lib";
import sharp from "sharp";

import {
  formatLimitMb,
  getTotalFileSize,
  PDF_UTILITY_LIMITS,
} from "./pdfUtilityLimits.js";

const ALLOWED_ROTATIONS = new Set([-90, 90, 180, 270]);

const ROTATABLE_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const WORD_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function validateFileSize(file, maxBytes, label) {
  if (file.size > maxBytes) {
    const error = new Error(
      `${label} exceeds the ${formatLimitMb(maxBytes)} MB limit.`,
    );
    error.statusCode = 400;
    throw error;
  }
}

function validateTotalSize(files, maxBytes, label) {
  const totalSize = getTotalFileSize(files);

  if (totalSize > maxBytes) {
    const error = new Error(
      `${label} exceeds the ${formatLimitMb(maxBytes)} MB total limit.`,
    );
    error.statusCode = 400;
    throw error;
  }
}

function normalizeRotationDegrees(rotationDegrees) {
  const selectedRotation = Number(rotationDegrees);

  if (!ALLOWED_ROTATIONS.has(selectedRotation)) {
    const error = new Error("Rotation must be -90, 90, 180, or 270 degrees.");
    error.statusCode = 400;
    throw error;
  }

  return selectedRotation === -90 ? 270 : selectedRotation;
}

function parseJsonField(value, fallbackValue) {
  if (!value) return fallbackValue;

  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
}

function buildPdfRotationInstructions({
  rotations,
  pageRanges,
  rotationDegrees,
  totalPages,
}) {
  const parsedRotations = parseJsonField(rotations, null);

  if (Array.isArray(parsedRotations) && parsedRotations.length > 0) {
    const instructions = [];

    for (const item of parsedRotations) {
      const page = Number(item.page);
      const rotation = normalizeRotationDegrees(item.degrees);

      if (!Number.isInteger(page) || page < 1 || page > totalPages) {
        const error = new Error(
          `Invalid page number ${item.page}. This file has ${totalPages} pages.`,
        );
        error.statusCode = 400;
        throw error;
      }

      instructions.push({
        page,
        degrees: rotation,
      });
    }

    return instructions;
  }

  const selectedRotation = normalizeRotationDegrees(rotationDegrees);

  const selectedPages = pageRanges
    ? parsePageRanges(pageRanges, totalPages)
    : Array.from({ length: totalPages }, (_, index) => index + 1);

  return selectedPages.map((page) => ({
    page,
    degrees: selectedRotation,
  }));
}

function getImageOutputDetails(file) {
  if (file.mimetype === "image/jpeg") {
    return {
      contentType: "image/jpeg",
      extension: "jpg",
      sharpFormat: "jpeg",
    };
  }

  if (file.mimetype === "image/webp") {
    return {
      contentType: "image/webp",
      extension: "webp",
      sharpFormat: "webp",
    };
  }

  return {
    contentType: "image/png",
    extension: "png",
    sharpFormat: "png",
  };
}

function parsePageRanges(pageRanges, totalPages) {
  if (!pageRanges || typeof pageRanges !== "string") {
    const error = new Error("Page ranges are required. Example: 1-3,5,8");
    error.statusCode = 400;
    throw error;
  }

  const selectedPages = new Set();

  const parts = pageRanges
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
        const error = new Error(`Invalid page range: ${part}`);
        error.statusCode = 400;
        throw error;
      }

      for (let page = start; page <= end; page += 1) {
        selectedPages.add(page);
      }
    } else {
      const page = Number(part);

      if (!Number.isInteger(page)) {
        const error = new Error(`Invalid page number: ${part}`);
        error.statusCode = 400;
        throw error;
      }

      selectedPages.add(page);
    }
  }

  const sortedPages = [...selectedPages].sort((a, b) => a - b);

  for (const page of sortedPages) {
    if (page < 1 || page > totalPages) {
      const error = new Error(
        `Page ${page} is outside the PDF page range. This file has ${totalPages} pages.`,
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return sortedPages;
}

export async function splitPdfByPageRange({ file, pageRanges }) {
  if (!file) {
    const error = new Error("PDF file is required.");
    error.statusCode = 400;
    throw error;
  }

  if (file.mimetype !== "application/pdf") {
    const error = new Error("Only PDF files are supported for split PDF.");
    error.statusCode = 400;
    throw error;
  }

  validateFileSize(
    file,
    PDF_UTILITY_LIMITS.singlePdfMaxBytes,
    "Split PDF file",
  );

  const sourcePdf = await PDFDocument.load(file.buffer);
  const totalPages = sourcePdf.getPageCount();

  if (totalPages > PDF_UTILITY_LIMITS.splitMaxPages) {
    const error = new Error(
      `Split PDF supports up to ${PDF_UTILITY_LIMITS.splitMaxPages} pages for now.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const selectedPages = parsePageRanges(pageRanges, totalPages);

  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(
    sourcePdf,
    selectedPages.map((page) => page - 1),
  );

  for (const copiedPage of copiedPages) {
    outputPdf.addPage(copiedPage);
  }

  const outputBytes = await outputPdf.save();

  return {
    buffer: Buffer.from(outputBytes),
    filename: `split-${Date.now()}.pdf`,
    metadata: {
      originalName: file.originalname,
      totalPages,
      selectedPages,
      outputPages: copiedPages.length,
    },
  };
}

export async function removePdfPages({ file, pageRanges }) {
  if (!file) {
    const error = new Error("PDF file is required.");
    error.statusCode = 400;
    throw error;
  }

  if (file.mimetype !== "application/pdf") {
    const error = new Error("Only PDF files are supported for Remove Pages.");
    error.statusCode = 400;
    throw error;
  }

  validateFileSize(
    file,
    PDF_UTILITY_LIMITS.singlePdfMaxBytes,
    "Remove Pages PDF file",
  );

  const sourcePdf = await PDFDocument.load(file.buffer);
  const totalPages = sourcePdf.getPageCount();

  if (totalPages > PDF_UTILITY_LIMITS.splitMaxPages) {
    const error = new Error(
      `Remove Pages supports up to ${PDF_UTILITY_LIMITS.splitMaxPages} pages for now.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const pagesToRemove = parsePageRanges(pageRanges, totalPages);
  const pagesToRemoveSet = new Set(pagesToRemove);

  if (pagesToRemoveSet.size >= totalPages) {
    const error = new Error("You cannot remove all pages from a PDF.");
    error.statusCode = 400;
    throw error;
  }

  const pagesToKeep = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  ).filter((pageNumber) => !pagesToRemoveSet.has(pageNumber));

  const outputPdf = await PDFDocument.create();

  const copiedPages = await outputPdf.copyPages(
    sourcePdf,
    pagesToKeep.map((page) => page - 1),
  );

  for (const copiedPage of copiedPages) {
    outputPdf.addPage(copiedPage);
  }

  const outputBytes = await outputPdf.save();

  return {
    buffer: Buffer.from(outputBytes),
    filename: `removed-pages-${Date.now()}.pdf`,
    contentType: "application/pdf",
    metadata: {
      originalName: file.originalname,
      totalPages,
      removedPages: pagesToRemove,
      outputPages: copiedPages.length,
    },
  };
}

export async function mergePdfFiles({ files = [] }) {
  if (!files.length) {
    const error = new Error("At least two PDF files are required.");
    error.statusCode = 400;
    throw error;
  }

  if (files.length < 2) {
    const error = new Error("Upload at least two PDFs to merge.");
    error.statusCode = 400;
    throw error;
  }

  if (files.length > PDF_UTILITY_LIMITS.mergeMaxFiles) {
    const error = new Error(
      `Merge PDF supports up to ${PDF_UTILITY_LIMITS.mergeMaxFiles} files.`,
    );
    error.statusCode = 400;
    throw error;
  }

  for (const file of files) {
    if (file.mimetype !== "application/pdf") {
      const error = new Error("Only PDF files are supported for merge PDF.");
      error.statusCode = 400;
      throw error;
    }

    validateFileSize(
      file,
      PDF_UTILITY_LIMITS.mergeSinglePdfMaxBytes,
      "One of the merge PDF files",
    );
  }

  validateTotalSize(
    files,
    PDF_UTILITY_LIMITS.mergeTotalMaxBytes,
    "Merge PDF files",
  );

  const outputPdf = await PDFDocument.create();

  const inputFiles = [];

  for (const file of files) {
    const sourcePdf = await PDFDocument.load(file.buffer);
    const pageCount = sourcePdf.getPageCount();

    const copiedPages = await outputPdf.copyPages(
      sourcePdf,
      Array.from({ length: pageCount }, (_, index) => index),
    );

    for (const copiedPage of copiedPages) {
      outputPdf.addPage(copiedPage);
    }

    inputFiles.push({
      originalName: file.originalname,
      pages: pageCount,
    });
  }

  const outputBytes = await outputPdf.save();

  return {
    buffer: Buffer.from(outputBytes),
    filename: `merged-${Date.now()}.pdf`,
    metadata: {
      inputFiles,
      outputPages: outputPdf.getPageCount(),
    },
  };
}

export async function rotateDocumentFile({
  file,
  rotationDegrees,
  pageRanges,
  rotations,
}) {
  if (!file) {
    const error = new Error("File is required.");
    error.statusCode = 400;
    throw error;
  }

  if (file.mimetype === "application/pdf") {
    validateFileSize(
      file,
      PDF_UTILITY_LIMITS.rotatePdfMaxBytes,
      "Rotate PDF file",
    );

    return rotatePdfDocument({
      file,
      rotationDegrees,
      pageRanges,
      rotations,
    });
  }

  if (ROTATABLE_IMAGE_MIME_TYPES.has(file.mimetype)) {
    validateFileSize(
      file,
      PDF_UTILITY_LIMITS.rotateImageMaxBytes,
      "Rotate image file",
    );

    return rotateImageDocument({
      file,
      rotationDegrees,
    });
  }

  if (WORD_MIME_TYPES.has(file.mimetype)) {
    const error = new Error(
      "Word document rotation will be supported after document-to-PDF conversion is added.",
    );
    error.statusCode = 501;
    throw error;
  }

  const error = new Error(
    "Unsupported file type. Upload a PDF, PNG, JPG, JPEG, or WebP file.",
  );
  error.statusCode = 400;
  throw error;
}

async function rotatePdfDocument({
  file,
  rotationDegrees,
  pageRanges,
  rotations,
}) {
  const sourcePdf = await PDFDocument.load(file.buffer);
  const totalPages = sourcePdf.getPageCount();

  if (totalPages > PDF_UTILITY_LIMITS.rotatePdfMaxPages) {
    const error = new Error(
      `Rotate PDF supports up to ${PDF_UTILITY_LIMITS.rotatePdfMaxPages} pages for now.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const instructions = buildPdfRotationInstructions({
    rotations,
    pageRanges,
    rotationDegrees,
    totalPages,
  });

  const pages = sourcePdf.getPages();

  for (const instruction of instructions) {
    const page = pages[instruction.page - 1];
    const currentRotation = page.getRotation().angle || 0;

    page.setRotation(degrees((currentRotation + instruction.degrees) % 360));
  }

  const outputBytes = await sourcePdf.save();

  return {
    buffer: Buffer.from(outputBytes),
    filename: `rotated-${Date.now()}.pdf`,
    contentType: "application/pdf",
    metadata: {
      originalName: file.originalname,
      sourceType: "pdf",
      totalPages,
      rotationsApplied: instructions,
    },
  };
}

async function rotateImageDocument({ file, rotationDegrees }) {
  const selectedRotation = normalizeRotationDegrees(rotationDegrees);
  const outputDetails = getImageOutputDetails(file);

  const outputBuffer = await sharp(file.buffer)
    .rotate(selectedRotation)
    .toFormat(outputDetails.sharpFormat)
    .toBuffer();

  return {
    buffer: outputBuffer,
    filename: `rotated-${Date.now()}.${outputDetails.extension}`,
    contentType: outputDetails.contentType,
    metadata: {
      originalName: file.originalname,
      sourceType: "image",
      rotationDegrees: selectedRotation,
    },
  };
}

export async function convertImagesToPdf({ files = [], rotations }) {
  if (!files.length) {
    const error = new Error("At least one image file is required.");
    error.statusCode = 400;
    throw error;
  }

  const parsedRotations = parseJsonField(rotations, []);

  if (files.length > PDF_UTILITY_LIMITS.imagesToPdfMaxFiles) {
    const error = new Error(
      `Images to PDF supports up to ${PDF_UTILITY_LIMITS.imagesToPdfMaxFiles} images.`,
    );
    error.statusCode = 400;
    throw error;
  }

  for (const file of files) {
    if (!ROTATABLE_IMAGE_MIME_TYPES.has(file.mimetype)) {
      const error = new Error(
        "Only PNG, JPG, JPEG, and WebP images are supported.",
      );
      error.statusCode = 400;
      throw error;
    }

    validateFileSize(
      file,
      PDF_UTILITY_LIMITS.imagesToPdfSingleImageMaxBytes,
      "One of the image files",
    );
  }

  validateTotalSize(
    files,
    PDF_UTILITY_LIMITS.imagesToPdfTotalMaxBytes,
    "Images to PDF files",
  );

  const outputPdf = await PDFDocument.create();

  const inputFiles = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    const rotationItem = parsedRotations.find(
      (item) => Number(item.index) === index,
    );

    const rotationDegrees = rotationItem
      ? normalizeRotationDegrees(rotationItem.degrees)
      : 0;

    let imageBuffer = file.buffer;

    if (rotationDegrees !== 0) {
      imageBuffer = await sharp(file.buffer).rotate(rotationDegrees).toBuffer();
    }

    const normalizedImage = await sharp(imageBuffer)
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();

    const image = await outputPdf.embedPng(normalizedImage);

    const page = outputPdf.addPage([image.width, image.height]);

    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    inputFiles.push({
      originalName: file.originalname,
      rotationDegrees,
      pageNumber: index + 1,
    });
  }

  const outputBytes = await outputPdf.save();

  return {
    buffer: Buffer.from(outputBytes),
    filename: `images-to-pdf-${Date.now()}.pdf`,
    contentType: "application/pdf",
    metadata: {
      sourceType: "images",
      inputFiles,
      outputPages: outputPdf.getPageCount(),
    },
  };
}

async function callDocumentEngineForUtility(payload) {
  const documentEngineUrl = process.env.DOCUMENT_ENGINE_URL;

  if (!documentEngineUrl) {
    const error = new Error("Document engine URL is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${documentEngineUrl}/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const error = new Error(
      data?.message || `Document engine failed with status ${response.status}`,
    );
    error.statusCode = response.status || 500;
    throw error;
  }

  if (!data.success) {
    const error = new Error(data.message || "Document engine utility failed.");
    error.statusCode = 422;
    error.engineError = data;
    throw error;
  }

  return data;
}

export async function convertPdfToImages({ file, imageFormat = "png" }) {
  if (!file) {
    const error = new Error("PDF file is required.");
    error.statusCode = 400;
    throw error;
  }

  if (file.mimetype !== "application/pdf") {
    const error = new Error("Only PDF files are supported for PDF to Images.");
    error.statusCode = 400;
    throw error;
  }

  validateFileSize(
    file,
    PDF_UTILITY_LIMITS.pdfToImagesMaxBytes,
    "PDF to Images file",
  );

  const engineResult = await callDocumentEngineForUtility({
    tool: "pdf-to-images",
    imageFormat,
    files: [
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        contentBase64: file.buffer.toString("base64"),
      },
    ],
  });

  if (!engineResult.contentBase64) {
    const error = new Error(
      "Document engine did not return a downloadable file.",
    );
    error.statusCode = 500;
    throw error;
  }

  return {
    buffer: Buffer.from(engineResult.contentBase64, "base64"),
    filename: engineResult.filename || `pdf-images-${Date.now()}.zip`,
    contentType: engineResult.contentType || "application/zip",
    metadata: engineResult.metadata || {},
  };
}

function toRomanNumber(number) {
  const romanMap = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];

  let value = number;
  let result = "";

  for (const [arabic, roman] of romanMap) {
    while (value >= arabic) {
      result += roman;
      value -= arabic;
    }
  }

  return result;
}

function toAlphabetNumber(number) {
  let value = number;
  let result = "";

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result;
}

function formatPageNumber({ style, pageNumber, totalPages }) {
  if (style === "page-x") {
    return `Page ${pageNumber}`;
  }

  if (style === "page-x-of-y") {
    return `Page ${pageNumber} of ${totalPages}`;
  }

  if (style === "leading-zero") {
    return String(pageNumber).padStart(2, "0");
  }

  if (style === "alphabet") {
    return toAlphabetNumber(pageNumber);
  }

  if (style === "roman") {
    return toRomanNumber(pageNumber);
  }

  return String(pageNumber);
}

function getPageNumberPosition({
  position,
  pageWidth,
  pageHeight,
  textWidth,
  fontSize,
  margin,
}) {
  const normalizedPosition = position || "bottom-center";

  const xPositions = {
    left: margin,
    center: (pageWidth - textWidth) / 2,
    right: pageWidth - textWidth - margin,
  };

  const yPositions = {
    top: pageHeight - margin - fontSize,
    bottom: margin,
  };

  const [vertical, horizontal] = normalizedPosition.split("-");

  return {
    x: xPositions[horizontal] ?? xPositions.center,
    y: yPositions[vertical] ?? yPositions.bottom,
  };
}

export async function addPdfPageNumbers({
  file,
  numberingStyle = "number",
  position = "bottom-center",
  fontSize = 12,
  margin = 28,
  startNumber = 1,
  pageRanges,
  skipFirstPage,
}) {
  if (!file) {
    const error = new Error("PDF file is required.");
    error.statusCode = 400;
    throw error;
  }

  if (file.mimetype !== "application/pdf") {
    const error = new Error("Only PDF files are supported for page numbers.");
    error.statusCode = 400;
    throw error;
  }

  validateFileSize(
    file,
    PDF_UTILITY_LIMITS.singlePdfMaxBytes,
    "Page Numbers PDF file",
  );

  const sourcePdf = await PDFDocument.load(file.buffer);
  const totalPages = sourcePdf.getPageCount();

  if (totalPages > PDF_UTILITY_LIMITS.splitMaxPages) {
    const error = new Error(
      `Page Numbers supports up to ${PDF_UTILITY_LIMITS.splitMaxPages} pages for now.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const selectedFontSize = Math.min(Math.max(Number(fontSize) || 12, 8), 48);
  const selectedMargin = Math.min(Math.max(Number(margin) || 28, 8), 120);
  const selectedStartNumber = Math.max(Number(startNumber) || 1, 1);

  let pagesToNumber = pageRanges
    ? parsePageRanges(pageRanges, totalPages)
    : Array.from({ length: totalPages }, (_, index) => index + 1);

  if (skipFirstPage === "true" || skipFirstPage === true) {
    pagesToNumber = pagesToNumber.filter((pageNumber) => pageNumber !== 1);
  }

  const pagesToNumberSet = new Set(pagesToNumber);
  const pages = sourcePdf.getPages();

  let visibleNumberIndex = selectedStartNumber;

  for (let index = 0; index < pages.length; index += 1) {
    const pageNumber = index + 1;

    if (!pagesToNumberSet.has(pageNumber)) continue;

    const page = pages[index];
    const { width, height } = page.getSize();

    const label = formatPageNumber({
      style: numberingStyle,
      pageNumber: visibleNumberIndex,
      totalPages,
    });

    const approxTextWidth = label.length * selectedFontSize * 0.55;

    const { x, y } = getPageNumberPosition({
      position,
      pageWidth: width,
      pageHeight: height,
      textWidth: approxTextWidth,
      fontSize: selectedFontSize,
      margin: selectedMargin,
    });

    page.drawText(label, {
      x,
      y,
      size: selectedFontSize,
    });

    visibleNumberIndex += 1;
  }

  const outputBytes = await sourcePdf.save();

  return {
    buffer: Buffer.from(outputBytes),
    filename: `page-numbers-${Date.now()}.pdf`,
    contentType: "application/pdf",
    metadata: {
      originalName: file.originalname,
      totalPages,
      numberedPages: pagesToNumber,
      numberingStyle,
      position,
      fontSize: selectedFontSize,
      margin: selectedMargin,
      startNumber: selectedStartNumber,
    },
  };
}
