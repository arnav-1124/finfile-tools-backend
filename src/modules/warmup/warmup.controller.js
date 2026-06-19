import { runWarmup } from "./warmup.service.js";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function validateWarmupSecret(req) {
  const configuredSecret = process.env.WARMUP_SECRET;

  if (!configuredSecret) {
    if (isProduction()) {
      const error = new Error("Warmup secret is not configured.");
      error.statusCode = 500;
      throw error;
    }

    return;
  }

  const receivedSecret =
    req.query.secret ||
    req.headers["x-warmup-secret"] ||
    req.headers["x-finfile-warmup-secret"];

  if (receivedSecret !== configuredSecret) {
    const error = new Error("Unauthorized warmup request.");
    error.statusCode = 401;
    throw error;
  }
}

export async function warmupController(req, res, next) {
  try {
    validateWarmupSecret(req);

    const result = await runWarmup();

    res.status(result.success ? 200 : 207).json(result);
  } catch (error) {
    next(error);
  }
}
