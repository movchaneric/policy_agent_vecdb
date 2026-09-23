import type { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { getVectorStore } from "./03_vectorStore.js";

// step 5 -> querying the vector store for chunks relevant to a question
type VectorStoreLike = Pick<
  MongoDBAtlasVectorSearch,
  "similaritySearchWithScore"
>;

export interface RetrievedChunk {
  text: string;
  score: number;
  source: string;
  chunkId: number;
  metadata: Record<string, unknown>;
}

export interface RetrieveOptions {
  k?: number;
  scoreThreshold?: number;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];
  confidence: number;
}

export async function retrieveChunks(
  namespace: string = "default",
  query: string,
  options: RetrieveOptions = {},
  vectorStore?: VectorStoreLike,
): Promise<RetrieveResult> {
  if (!namespace) {
    throw new Error("Namespace is needed");
  }

  if (!query.trim()) {
    throw new Error("Query is needed");
  }

  const store = vectorStore ?? (await getVectorStore());
  const k = options.k ?? 4;

  // namespace must be indexed as a `type: "filter"` field on kb_vector_index
  // in Atlas for this preFilter to actually narrow results instead of erroring
  const matches = await store.similaritySearchWithScore(query, k, {
    preFilter: { namespace: { $eq: namespace } },
  });

  // best raw score before threshold pruning: whether or not any chunk clears
  // scoreThreshold, this says how close the nearest match was. Clamped to
  // [0,1] on the assumption vectorSearchScore is cosine/dotProduct-normalized -
  // confirm against the similarity metric picked when kb_vector_index was created,
  // since that's set manually in Atlas and isn't visible from this code
  const bestScore = matches[0]?.[1] ?? 0;
  const confidence = Number(Math.max(0, Math.min(1, bestScore)).toFixed(2));

  const filtered =
    options.scoreThreshold != null
      ? matches.filter(([, score]) => score >= options.scoreThreshold!)
      : matches;

  const chunks = filtered.map(([doc, score]) => ({
    text: doc.pageContent,
    score,
    source: doc.metadata.source as string,
    chunkId: doc.metadata.chunkId as number,
    metadata: doc.metadata,
  }));

  return { chunks, confidence };
}
