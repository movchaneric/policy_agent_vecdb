import { Collection as MongoCollection } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { getDb } from "../utils/mongodb.js";
import { embeddings } from "../utils/openai.js";
import { stepLogger } from "../utils/logger.js";

const logger = stepLogger("03_vectorStore");

// step 3 -> connecting to the Mongo Atlas collection that backs vector search
const KB_COLLECTION_NAME = "kb_chunks";
const KB_INDEX_NAME = "kb_vector_index";

let collectionPromise: Promise<MongoCollection> | null = null;
let vectorStorePromise: Promise<MongoDBAtlasVectorSearch> | null = null;

export async function getKbCollection(): Promise<MongoCollection> {
  if (!collectionPromise) {
    logger.info({ collectionName: KB_COLLECTION_NAME }, "opening kb collection (first call)");
    collectionPromise = (async () => {
      const db = await getDb();
      return db.collection(KB_COLLECTION_NAME);
    })();
  } else {
    logger.debug({ collectionName: KB_COLLECTION_NAME }, "reusing cached kb collection");
  }

  return collectionPromise;
}

export async function getVectorStore(): Promise<MongoDBAtlasVectorSearch> {
  if (!vectorStorePromise) {
    logger.info(
      { collectionName: KB_COLLECTION_NAME, indexName: KB_INDEX_NAME },
      "creating vector store (first call)",
    );
    vectorStorePromise = (async () => {
      const collection = await getKbCollection(); // KB_COLLECTION_NAME

      return new MongoDBAtlasVectorSearch(embeddings, {
        collection,
        indexName: KB_INDEX_NAME,
        // matches KBChunk's `text`/`embedding` fields in ../types/kb.ts
        textKey: "text",
        embeddingKey: "embedding",
      });
    })();
  } else {
    logger.debug({ indexName: KB_INDEX_NAME }, "reusing cached vector store");
  }

  return vectorStorePromise;
}
