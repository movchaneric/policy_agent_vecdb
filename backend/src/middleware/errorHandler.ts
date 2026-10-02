import type { ErrorRequestHandler } from "express";
import multer from "multer";

// errors thrown by middleware (multer, express.json) never reach a route's try/catch
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    res
      .status(tooLarge ? 413 : 400)
      .json({ ok: false, error: tooLarge ? "File too large" : err.message });
    return;
  }

  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ ok: false, error: "Request body is not valid JSON" });
    return;
  }

  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
};
