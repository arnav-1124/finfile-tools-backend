import { extractPdfImageToExcel } from "../services/pdfImageToExcel.service.js";

export async function extractPdfImageToExcelController(req, res, next) {
  try {
    const result = await extractPdfImageToExcel({
      files: req.files || [],
      extractionMode: req.body?.extractionMode,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
