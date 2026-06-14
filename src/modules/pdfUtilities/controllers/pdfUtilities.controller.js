import {
  mergePdfFiles,
  rotateDocumentFile,
  splitPdfByPageRange,
} from "../services/pdfUtilities.service.js";

export async function splitPdfController(req, res, next) {
  try {
    const result = await splitPdfByPageRange({
      file: req.file,
      pageRanges: req.body?.pageRanges,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader("X-PDF-Utility-Metadata", JSON.stringify(result.metadata));

    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
}

export async function mergePdfController(req, res, next) {
  try {
    const result = await mergePdfFiles({
      files: req.files || [],
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader("X-PDF-Utility-Metadata", JSON.stringify(result.metadata));

    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
}

export async function rotatePdfController(req, res, next) {
  try {
    const result = await rotateDocumentFile({
      file: req.file,
      rotationDegrees: req.body?.rotationDegrees,
      pageRanges: req.body?.pageRanges,
      rotations: req.body?.rotations,
    });

    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader(
      "X-Document-Utility-Metadata",
      JSON.stringify(result.metadata),
    );

    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
}
