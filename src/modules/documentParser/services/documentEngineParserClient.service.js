const documentEngineUrl = process.env.DOCUMENT_ENGINE_URL;
const parserTimeoutMs = Number(
  process.env.DOCUMENT_PARSER_TIMEOUT_MS || 120000,
);

function createDocumentEngineUnavailableError() {
  const error = new Error(
    "Document parser service is currently unavailable. Please try again in a moment.",
  );
  error.statusCode = 503;
  return error;
}

function createDocumentParserTimeoutError() {
  const error = new Error(
    "Document parsing is taking longer than expected. Please try again with a smaller or clearer file.",
  );
  error.statusCode = 504;
  return error;
}

export async function callDocumentEngineParser(payload) {
  if (!documentEngineUrl) {
    const error = new Error("Document engine URL is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, parserTimeoutMs);

  try {
    const response = await fetch(`${documentEngineUrl}/v1/parse/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      const error = new Error(
        data?.message ||
          `Document parser failed with status ${response.status}`,
      );
      error.statusCode = response.status || 500;
      throw error;
    }

    if (!data.success) {
      const error = new Error(data.message || "Document parser failed.");
      error.statusCode = 422;
      error.parserError = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw createDocumentParserTimeoutError();
    }

    if (
      error.message === "fetch failed" ||
      error.cause?.code === "ECONNREFUSED"
    ) {
      throw createDocumentEngineUnavailableError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
