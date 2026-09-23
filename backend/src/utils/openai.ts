import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { env } from "./env.js";

export const chatModel = new ChatOpenAI({
  apiKey: env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 0.2,
});

export const embeddings = new OpenAIEmbeddings({
  apiKey: env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
});
