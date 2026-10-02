import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";

let clientPromise: Promise<MongoClient> | undefined;
let db: Db | undefined;

export function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const newClient = new MongoClient(env.MONGODB_ATLAS_URI);
    clientPromise = newClient.connect().catch((err) => {
      // don't cache a failed connect, or every later call re-throws it until restart
      clientPromise = undefined;
      throw err;
    });
  }

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  if (db) return db;

  const extractMongoClient = await getMongoClient();

  db = extractMongoClient.db(env.MONGODB_DB_NAME);

  return db;
}

export async function closeDatabaseConnection(): Promise<void> {
  const pending = clientPromise;
  clientPromise = undefined;
  db = undefined;
  await (await pending)?.close();
}
