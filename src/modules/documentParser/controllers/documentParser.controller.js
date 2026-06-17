import { parseDocumentFile } from "../services/documentParser.service.js";

export async function parseDocumentController(req, res, next) {
  try {
    const result = await parseDocumentFile({
      file: req.file,
      parserMode: req.body?.parserMode || "AUTO",
      qualityMode: req.body?.qualityMode || "BALANCED",
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
