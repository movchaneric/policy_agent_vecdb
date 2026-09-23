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

export async function retrieveChunks(
  namespace: string = "default",
  query: string,
  options: RetrieveOptions = {},
  vectorStore?: VectorStoreLike,
): Promise<RetrievedChunk[]> {
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

  const filtered =
    options.scoreThreshold != null
      ? matches.filter(([, score]) => score >= options.scoreThreshold!)
      : matches;

  return filtered.map(([doc, score]) => ({
    text: doc.pageContent,
    score,
    source: doc.metadata.source as string,
    chunkId: doc.metadata.chunkId as number,
    metadata: doc.metadata,
  }));
}
