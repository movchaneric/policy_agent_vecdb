import { readFile, stat } from "fs/promises";
// Document lives in @langchain/core, importing it from there (rather than the top-level
// "langchain" package) avoids pulling in the whole framework just for this one class
import { Document } from "@langchain/core/documents";
// TextLoader: LangChain's built-in loader for plain-text files (reads the file and wraps it in a Document)
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
// PDFParse: parses a PDF buffer and extracts text per page
import { PDFParse } from "pdf-parse";
import type { Logger } from "pino";
import { stepLogger } from "../utils/logger.js";

const defaultLogger = stepLogger("01_loaders");

// step 1 -> loading raw file as a document structure
interface LoadFileArgs {
  filePath: string;
  mimeType: string;
  originalName: string;
}

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index + 1).toLocaleLowerCase();
}

async function loadPdfAsDocuments(
  filePath: string,
  originalName: string,
  log: Logger,
): Promise<Document[]> {
  // create a PDF parser fed with the raw file bytes
  const parser = new PDFParse({
    data: new Uint8Array(await readFile(filePath)),
  });
  try {
    // extract text page by page
    const { pages, total } = await parser.getText();
    log.debug({ totalPages: total }, "pdf parsed");

    // turn each page's text into its own Document, tagging it with the page number
    // (0-indexed) and total page count so later citations can say "page X of Y"
    const docs = pages.map(
      (page) =>
        new Document({
          pageContent: page.text,
          metadata: {
            source: originalName,
            page: page.num - 1,
            totalPages: total,
          },
        }),
    );

    log.debug(
      {
        pageCharCounts: docs.map((doc) => doc.pageContent.length),
        firstPagePreview: docs[0]?.pageContent.slice(0, 200),
      },
      "pdf pages converted to documents",
    );

    return docs;
  } catch (err) {
    log.error({ err }, "failed to parse pdf");
    throw err;
  } finally {
    // release the parser's resources once we're done reading
    await parser.destroy();
  }
}

export async function loadFileAsDocuments(
  args: LoadFileArgs,
  logger: Logger = defaultLogger,
): Promise<Document[]> {
  const { filePath, mimeType, originalName } = args;
  const start = performance.now();

  const fileSize = await stat(filePath)
    .then((s) => s.size)
    .catch(() => undefined);

  const fileExtension = getExtension(originalName); // pdf, txt, md, etc

  const isMarkdown =
    mimeType === "text/markdown" ||
    fileExtension === "md" ||
    fileExtension === "markdown";

  const isText = mimeType === "text/plain" || fileExtension === "txt";

  const isPDF =
    mimeType === "application/pdf" || fileExtension === "pdf";

  logger.info(
    { originalName, mimeType, fileExtension, fileSize, filePath },
    "loading file",
  );

  let docs: Document[];

  if (isMarkdown || isText) {
    // TextLoader takes a file path and handles reading + wrapping it as a Document internally
    const loader = new TextLoader(filePath);
    // load() reads the file from disk and returns Document[] (one Document here, since TextLoader doesn't split pages)
    const loaded = await loader.load();
    // re-map to attach our own metadata (original filename, mime type) on top of what TextLoader gave us
    docs = loaded.map(
      (doc) =>
        new Document({
          pageContent: doc.pageContent,
          metadata: { ...doc.metadata, source: originalName, mimeType },
        }),
    );
    logger.debug(
      { type: isMarkdown ? "markdown" : "text", charCount: docs[0]?.pageContent.length },
      "loaded as single text document",
    );
  } else if (isPDF) {
    docs = await loadPdfAsDocuments(filePath, originalName, logger);
  } else {
    logger.error({ mimeType, fileExtension }, "unsupported file type");
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  logger.info(
    {
      originalName,
      documentCount: docs.length,
      totalChars: docs.reduce((sum, d) => sum + d.pageContent.length, 0),
      durationMs: Math.round(performance.now() - start),
    },
    "file loaded",
  );

  return docs;
}
