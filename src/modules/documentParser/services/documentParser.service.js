import { callDocumentEngineParser } from "./documentEngineParserClient.service.js";

export async function parseDocumentFile({ file, parserMode = "AUTO" }) {
  if (!file) {
    const error = new Error("File is required for document parsing.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    jobId: `sync_parse_${Date.now()}`,
    parserMode,
    files: [
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        contentBase64: file.buffer.toString("base64"),
      },
    ],
  };

  return callDocumentEngineParser(payload);
}
