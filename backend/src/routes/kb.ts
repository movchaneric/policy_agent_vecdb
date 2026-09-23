import { Router } from "express";
import multer from "multer";
import { unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { loadFileAsDocuments } from "../kb/01_loaders.js";
import { splitDocuments } from "../kb/02_splitter.js";
import { ingestDocuments } from "../kb/04_ingestor.js";
import { logger } from "../utils/logger.js";

export const kdRouter = Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1021 * 1024, // 10mb
  },
});

kdRouter.post("/upload", upload.single("file"), async (req, res) => {
  // requestId ties together every log line this upload produces, across all
  // pipeline steps - filter on it in logs/kb-pipeline.log or in the Axiom UI
  // to see one upload's full trace
  const requestId = randomUUID();
  const reqLogger = logger.child({ requestId });

  if (!req.file) {
    reqLogger.warn("upload request rejected: no file attached");
    res.status(400).json({ ok: false, error: "No file uploaded" });
    return;
  }

  const { path, mimetype, originalname, size } = req.file;
  const namespace = (req.body.namespace as string | undefined) ?? "default";
  const start = performance.now();

  reqLogger.info(
    { originalname, mimetype, size, namespace },
    "upload request received",
  );

  try {
    // Step 1 -> load the uploaded file into Documents (per-page for PDFs, whole-file for text/markdown)
    const rawDocs = await loadFileAsDocuments(
      { filePath: path, mimeType: mimetype, originalName: originalname },
      reqLogger,
    );

    // Step 2 -> split into ~1000-char overlapping chunks, each stamped with a chunkId
    const chunks = await splitDocuments(rawDocs, undefined, reqLogger);

    // Step 3 -> embed the chunks and upsert them into the Atlas vector store under this namespace
    const summary = await ingestDocuments(namespace, chunks, reqLogger);

    reqLogger.info(
      { summary, durationMs: Math.round(performance.now() - start) },
      "upload request completed",
    );

    res.status(201).json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    reqLogger.error(
      { err, durationMs: Math.round(performance.now() - start) },
      "upload request failed",
    );
    res.status(500).json({ ok: false, error: message });
  } finally {
    await unlink(path).catch((unlinkErr) =>
      reqLogger.warn({ err: unlinkErr, path }, "failed to clean up temp upload file"),
    );
  }
});
