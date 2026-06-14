import { spawn } from "node:child_process";

const pythonPath = process.env.DOCUMENT_ENGINE_PYTHON_PATH || "python";
const engineCwd = process.env.DOCUMENT_ENGINE_CWD || "../document-engine";

const timeoutMs = Number(process.env.DOCUMENT_ENGINE_TIMEOUT_MS || 30000);

async function callDocumentEngineApi(payload) {
  const documentEngineUrl = process.env.DOCUMENT_ENGINE_URL;

  if (!documentEngineUrl) {
    return null;
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
      data?.message ||
        `Document engine API failed with status ${response.status}`,
    );
    error.statusCode = response.status || 500;
    throw error;
  }

  return data;
}

function parseDocumentEngineOutput(stdout) {
  const trimmedOutput = stdout.trim();

  if (!trimmedOutput) {
    throw new Error("Document engine returned empty output.");
  }

  const lines = trimmedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (!line.startsWith("{")) continue;

    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }

  throw new Error(
    `Document engine did not return valid JSON. Output: ${trimmedOutput}`,
  );
}

function createEnginePayload({ files, extractionMode }) {
  return {
    tool: "pdf-image-to-excel",
    extractionMode,
    files: files.map((file) => ({
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      contentBase64: file.buffer.toString("base64"),
    })),
  };
}

export async function runPdfImageToExcelEngine({ files, extractionMode }) {
  const payload = createEnginePayload({ files, extractionMode });

  const apiResult = await callDocumentEngineApi(payload);

  if (apiResult) {
    if (!apiResult.success) {
      const error = new Error(
        apiResult.message || "Document engine API failed.",
      );
      error.statusCode = 422;
      error.engineError = apiResult;
      throw error;
    }

    return apiResult;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, ["-m", "app.main"], {
      cwd: engineCwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const finishWithError = (error) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const finishWithSuccess = (result) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");

      const error = new Error("Document engine timed out.");
      error.statusCode = 504;
      finishWithError(error);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      error.statusCode = 500;
      finishWithError(error);
    });

    child.on("close", (code) => {
      if (isSettled) return;

      if (!stdout) {
        const error = new Error(
          stderr || `Document engine exited without output. Code: ${code}`,
        );
        error.statusCode = 500;
        finishWithError(error);
        return;
      }

      try {
        const parsed = parseDocumentEngineOutput(stdout);

        if (!parsed.success) {
          const error = new Error(parsed.message || "Document engine failed.");
          error.statusCode = 422;
          error.engineError = parsed;
          finishWithError(error);
          return;
        }

        finishWithSuccess(parsed);
      } catch (error) {
        error.message = `Failed to parse document engine output: ${error.message}`;
        error.statusCode = 500;
        finishWithError(error);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
