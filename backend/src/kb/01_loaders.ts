import { readFile } from "fs/promises";
// Document lives in @langchain/core, importing it from there (rather than the top-level
// "langchain" package) avoids pulling in the whole framework just for this one class
import { Document } from "@langchain/core/documents";
// TextLoader: LangChain's built-in loader for plain-text files (reads the file and wraps it in a Document)
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
// PDFParse: parses a PDF buffer and extracts text per page
import { PDFParse } from "pdf-parse";

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
): Promise<Document[]> {
  // create a PDF parser fed with the raw file bytes
  const parser = new PDFParse({
    data: new Uint8Array(await readFile(filePath)),
  });
  try {
    // extract text page by page
    const { pages, total } = await parser.getText();
    // turn each page's text into its own Document, tagging it with the page number
    // (0-indexed) and total page count so later citations can say "page X of Y"
    return pages.map(
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
  } finally {
    // release the parser's resources once we're done reading
    await parser.destroy();
  }
}

export async function loadFileAsDocuments(
  args: LoadFileArgs,
): Promise<Document[]> {
  const { filePath, mimeType, originalName } = args;

  const extractFileExtenstion = getExtension(originalName); // pdf, txt, md, etc

  const isMarkdown =
    mimeType === "text/markdown" ||
    extractFileExtenstion === "md" ||
    extractFileExtenstion === "markdown";

  const isText = mimeType === "text/plain" || extractFileExtenstion === "txt";

  const isPDF =
    mimeType === "application/pdf" || extractFileExtenstion === "pdf";

  if (isMarkdown || isText) {
    // TextLoader takes a file path and handles reading + wrapping it as a Document internally
    const loader = new TextLoader(filePath);
    // load() reads the file from disk and returns Document[] (one Document here, since TextLoader doesn't split pages)
    const docs = await loader.load();
    // re-map to attach our own metadata (original filename, mime type) on top of what TextLoader gave us
    return docs.map(
      (doc) =>
        new Document({
          pageContent: doc.pageContent,
          metadata: { ...doc.metadata, source: originalName, mimeType },
        }),
    );
  }

  if (isPDF) {
    return loadPdfAsDocuments(filePath, originalName);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
