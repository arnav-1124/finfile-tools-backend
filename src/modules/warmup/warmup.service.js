const documentEngineUrl = process.env.DOCUMENT_ENGINE_URL;

const warmupTimeoutMs = Number(process.env.WARMUP_TIMEOUT_MS || 180000);

function isEnabled(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).toLowerCase() === "true";
}

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return { controller, timeout };
}

async function fetchDocumentEngineJson(path, options = {}) {
  if (!documentEngineUrl) {
    return {
      success: false,
      skipped: true,
      message: "DOCUMENT_ENGINE_URL is not configured.",
    };
  }

  const { controller, timeout } = createTimeoutController(
    options.timeoutMs || warmupTimeoutMs,
  );

  try {
    const response = await fetch(`${documentEngineUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    return {
      success: response.ok,
      statusCode: response.status,
      data,
    };
  } catch (error) {
    return {
      success: false,
      statusCode: error.name === "AbortError" ? 504 : 503,
      message:
        error.name === "AbortError"
          ? "Document engine warmup timed out."
          : error.message || "Document engine warmup failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function warmupParserModel({ parserMode, qualityMode, language }) {
  return fetchDocumentEngineJson("/v1/models/warmup", {
    method: "POST",
    body: {
      parserMode,
      qualityMode,
      language,
    },
  });
}

export async function runWarmup() {
  const startedAt = Date.now();

  const enableDocumentEngineWarmup = isEnabled(
    process.env.ENABLE_DOCUMENT_ENGINE_WARMUP,
    true,
  );

  const warmupOcrText = isEnabled(process.env.WARMUP_OCR_TEXT, true);
  const warmupDocumentParse = isEnabled(
    process.env.WARMUP_DOCUMENT_PARSE,
    false,
  );

  const qualityMode = process.env.WARMUP_QUALITY_MODE || "BALANCED";
  const language = process.env.WARMUP_LANGUAGE || "en";

  const checks = {
    backend: {
      success: true,
      message: "Backend is awake.",
      timestamp: new Date().toISOString(),
    },
    documentEngineStatus: null,
    ocrTextWarmup: null,
    documentParseWarmup: null,
  };

  if (!enableDocumentEngineWarmup) {
    return {
      success: true,
      message: "Backend warmup completed. Document engine warmup is disabled.",
      warmed: {
        backend: true,
        documentEngine: false,
        ocrText: false,
        documentParse: false,
      },
      performance: {
        totalMs: Date.now() - startedAt,
      },
    };
  }

  checks.documentEngineStatus =
    await fetchDocumentEngineJson("/v1/models/status");

  if (warmupOcrText) {
    checks.ocrTextWarmup = await warmupParserModel({
      parserMode: "OCR_TEXT",
      qualityMode,
      language,
    });
  }

  if (warmupDocumentParse) {
    checks.documentParseWarmup = await warmupParserModel({
      parserMode: "DOCUMENT_PARSE",
      qualityMode,
      language,
    });
  }

  const failedChecks = Object.values(checks).filter(
    (check) => check && check.success === false && !check.skipped,
  );

  return {
    success: failedChecks.length === 0,
    message:
      failedChecks.length === 0
        ? "Warmup completed."
        : "Warmup completed with one or more failed checks.",
    warmed: {
      backend: true,
      documentEngine: Boolean(checks.documentEngineStatus?.success),
      ocrText: Boolean(checks.ocrTextWarmup?.success),
      documentParse: Boolean(checks.documentParseWarmup?.success),
    },
    config: {
      warmupOcrText,
      warmupDocumentParse,
      qualityMode,
      language,
    },
    performance: {
      totalMs: Date.now() - startedAt,
    },
  };
}
