import { Document } from "@langchain/core/documents";
import { getVectorStore } from "./03_vectorStore.js";

// step 4 -> writing split chunks into the Atlas vector store
export interface IngestSummary {
  ok: boolean;
  totalChunks: number;
  sources: string[];
}

// each stored doc becomes a flat KBChunk row (see ../types/kb.ts):
// { text: pageContent, embedding: [...], source, chunkId, ...rest of chunk.metadata (page, totalPages, ...) }
export async function ingestDocuments(chunks: Document[]): Promise<IngestSummary> {
  if (!chunks.length) {
    return {
      ok: false,
      totalChunks: 0,
      sources: [],
    };
  }

  const vectorStore = await getVectorStore();

  const docsWithMeta = chunks.map((chunk, index) => {
    const source = (chunk.metadata?.source as string) ?? "unknown_source";
    // splitDocuments already stamps a chunkId; fall back to the array index
    // for any chunk that didn't go through that step
    const chunkId = (chunk.metadata?.chunkId as number) ?? index;

    return new Document({
      pageContent: chunk.pageContent,
      metadata: { ...chunk.metadata, source, chunkId },
    });
  });

  // deterministic id per (source, chunkId) so re-ingesting the same file
  // upserts its chunks in place instead of duplicating them
  const ids = docsWithMeta.map(
    (doc) => `${doc.metadata.source}::${doc.metadata.chunkId}`,
  );

  // Ingestion to vector db (embeds each chunk via OpenAI, then upserts into Mongo Atlas)
  await vectorStore.addDocuments(docsWithMeta, { ids });

  const sources = Array.from(
    new Set(docsWithMeta.map((doc) => doc.metadata.source as string)),
  );

  return {
    ok: true,
    totalChunks: docsWithMeta.length,
    sources,
  };
}
