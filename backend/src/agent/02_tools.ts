// step 2 -> the kb_search tool the agent calls to fetch documentation contexts

import { z } from "zod";
import { tool } from "langchain";
import { retrieveChunks } from "../kb/05_retriever.js";

const PREVIEW_LENGTH = 200;
const MIN_RELEVANCE_SCORE = 0.5;
// a KB with several similar documents (e.g. more than one CV) needs more than the
// top 4 chunks, or one document's chunks can crowd out another's
const RETRIEVE_TOP_K = 8;

export function createKbSearchTool() {
  return tool(
    async ({ question }) => {
      const { chunks, confidence } = await retrieveChunks(question, {
        k: RETRIEVE_TOP_K,
        scoreThreshold: MIN_RELEVANCE_SCORE,
      });

      console.log("kbSearchTool chunks: ", chunks);

      // chunkId is stringified to match the "chunkId": string shape in the
      // agent's system prompt (01_policy.ts)
      const contexts = chunks.map((chunk) => ({
        source: chunk.source,
        chunkId: String(chunk.chunkId),
        preview: chunk.text.slice(0, PREVIEW_LENGTH),
        text: chunk.text,
        score: chunk.score,
      }));

      return JSON.stringify({ contexts, confidence });
    },
    {
      name: "kb_search",
      description:
        "Search the knowledge base for documentation chunks relevant to a question. Returns contexts (source, chunkId, preview, text, score) and an overall confidence between 0 and 1.",
      schema: z.object({
        question: z
          .string()
          .min(1)
          .describe("Users question or a follow up, must be answered from KB"),
      }),
    },
  );
}
