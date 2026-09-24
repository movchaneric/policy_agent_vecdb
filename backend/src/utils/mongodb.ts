import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";
import { logger } from "./logger.js";

let client: MongoClient | undefined;
let db: Db | undefined;

async function getMongoClient(): Promise<MongoClient> {
  if (client) return client;

  client = new MongoClient(env.MONGODB_ATLAS_URI);
  await client.connect();

  logger.info("connected to MongoDB");
  return client;
}

export async function getDb(): Promise<Db> {
  if (db) return db;

  const extractMongoClient = await getMongoClient();

  db = extractMongoClient.db(env.MONGODB_DB_NAME);

  logger.info({ dbName: env.MONGODB_DB_NAME }, "using mongodb database");

  return db;
}

export async function closeDatabaseConnection(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
}
