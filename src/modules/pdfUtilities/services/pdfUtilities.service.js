import { PDFDocument } from "pdf-lib";

const MAX_MERGE_SIZE_BYTES = 15 * 1024 * 1024;

function getTotalFileSize(files) {
  return files.reduce((total, file) => total + file.size, 0);
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

  const sourcePdf = await PDFDocument.load(file.buffer);
  const totalPages = sourcePdf.getPageCount();

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

  for (const file of files) {
    if (file.mimetype !== "application/pdf") {
      const error = new Error("Only PDF files are supported for merge PDF.");
      error.statusCode = 400;
      throw error;
    }
  }

  const totalSize = getTotalFileSize(files);

  if (totalSize > MAX_MERGE_SIZE_BYTES) {
    const error = new Error("Merge PDF limit is 15 MB.");
    error.statusCode = 400;
    throw error;
  }

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
