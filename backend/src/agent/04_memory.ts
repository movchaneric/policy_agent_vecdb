// step 4 -> conversation memory: a Mongo-backed checkpointer keyed by thread_id

import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { env } from "../utils/env.js";
import { getMongoClient } from "../utils/mongodb.js";

// Sliding: every checkpoint write refreshes upserted_at, so only idle threads expire.
const MEMORY_TTL_SECONDS = 2 * 24 * 60 * 60;

export const checkpointer = new MongoDBSaver({
  client: await getMongoClient(),
  dbName: env.MONGODB_DB_NAME,
  ttl: MEMORY_TTL_SECONDS,
});
