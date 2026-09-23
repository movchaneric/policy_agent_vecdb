import { Router } from "express";
import multer from "multer";
import { unlink } from "fs/promises";
import { loadFileAsDocuments } from "../kb/01_loaders.js";
import { splitDocuments } from "../kb/02_splitter.js";
import { ingestDocuments } from "../kb/04_ingestor.js";

export const kdRouter = Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1021 * 1024, // 10mb
  },
});

kdRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, error: "No file uploaded" });
    return;
  }

  const { path, mimetype, originalname } = req.file;
  const namespace = (req.body.namespace as string | undefined) ?? "default";

  try {
    // Step 1 -> load the uploaded file into Documents (per-page for PDFs, whole-file for text/markdown)
    const rawDocs = await loadFileAsDocuments({
      filePath: path,
      mimeType: mimetype,
      originalName: originalname,
    });

    // Step 2 -> split into ~1000-char overlapping chunks, each stamped with a chunkId
    const chunks = await splitDocuments(rawDocs);

    // Step 3 -> embed the chunks and upsert them into the Atlas vector store under this namespace
    const summary = await ingestDocuments(namespace, chunks);

    res.status(201).json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ ok: false, error: message });
  } finally {
    await unlink(path).catch(() => {});
  }
});
