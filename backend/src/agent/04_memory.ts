// step 4 -> conversation memory: a Mongo-backed checkpointer keyed by thread_id, plus summarization of long threads

import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { summarizationMiddleware } from "langchain";
import { env } from "../utils/env.js";
import { getMongoClient } from "../utils/mongodb.js";
import { chatModel } from "../utils/openai.js";

// Sliding: every checkpoint write refreshes upserted_at, so only idle threads expire.
const MEMORY_TTL_SECONDS = 2 * 24 * 60 * 60;

export const checkpointer = new MongoDBSaver({
  client: await getMongoClient(),
  dbName: env.MONGODB_DB_NAME,
  ttl: MEMORY_TTL_SECONDS,
});

export const memoryMiddleware = summarizationMiddleware({
  model: chatModel,
  trigger: { tokens: 4000 },
  keep: { messages: 10 },
});
