import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Logger } from "pino";
import { stepLogger } from "../utils/logger.js";

const defaultLogger = stepLogger("02_splitter");

// step 2 -> splitting loaded documents into retrieval-sized chunks
interface SplitDocumentsOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

// example input:
// docs = [ Document({ pageContent: "<~1400 chars of policy text>",
//                      metadata: { source: "policy.pdf", page: 2, totalPages: 10 } }) ]
export async function splitDocuments(
  docs: Document[],
  options?: SplitDocumentsOptions,
  logger: Logger = defaultLogger,
): Promise<Document[]> {
  const chunkSize = options?.chunkSize ?? 1000;
  const chunkOverlap = options?.chunkOverlap ?? 200;
  const start = performance.now();

  logger.info(
    {
      inputDocumentCount: docs.length,
      inputTotalChars: docs.reduce((sum, d) => sum + d.pageContent.length, 0),
      chunkSize,
      chunkOverlap,
    },
    "splitting documents",
  );

  // splitter is now configured to cut on ~1000-char boundaries with 200 chars of overlap
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });

  // splitDocuments (as opposed to splitText) carries each source Document's
  // metadata over onto every chunk it produces
  // our ~1400-char example doc splits into 2 pieces, each still tagged with the original metadata:
  // chunks = [
  //   Document({ pageContent: "<first ~1000 chars>", metadata: { source: "policy.pdf", page: 2, totalPages: 10 } }),
  //   Document({ pageContent: "<remaining ~400 chars + overlap>", metadata: { source: "policy.pdf", page: 2, totalPages: 10 } }),
  // ]
  // note: chunkId is NOT set yet at this point - that's added below
  const chunks = await splitter.splitDocuments(docs);

  // walk the chunks and stamp a 0-based chunkId onto each one's metadata, e.g.:
  // index 0 -> new Document({ pageContent: "<first ~1000 chars>",
  //              metadata: { source: "policy.pdf", page: 2, totalPages: 10, chunkId: 0 } })
  // index 1 -> new Document({ pageContent: "<remaining ~400 chars>",
  //              metadata: { source: "policy.pdf", page: 2, totalPages: 10, chunkId: 1 } })
  const chunksWithIds = chunks.map(
    (chunk, index) =>
      new Document({
        pageContent: chunk.pageContent,
        metadata: { ...chunk.metadata, chunkId: index },
      }),
  );

  const chunkLengths = chunksWithIds.map((c) => c.pageContent.length);
  logger.info(
    {
      outputChunkCount: chunksWithIds.length,
      minChunkChars: chunkLengths.length ? Math.min(...chunkLengths) : 0,
      maxChunkChars: chunkLengths.length ? Math.max(...chunkLengths) : 0,
      avgChunkChars: chunkLengths.length
        ? Math.round(chunkLengths.reduce((a, b) => a + b, 0) / chunkLengths.length)
        : 0,
      durationMs: Math.round(performance.now() - start),
    },
    "documents split into chunks",
  );
  logger.debug(
    { firstChunkPreview: chunksWithIds[0]?.pageContent.slice(0, 200) },
    "first chunk preview",
  );

  return chunksWithIds;
}
