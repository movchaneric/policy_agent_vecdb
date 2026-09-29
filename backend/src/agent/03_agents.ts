// step 3 -> the agent that answers questions by calling kb_search

import { createAgent, providerStrategy } from "langchain";
import { z } from "zod";
import { chatModel } from "../utils/openai.js";
import { createKbSearchTool } from "./02_tools.js";
import { AGENT_SYSTEM_PROMPT } from "./01_policy.js";
import { checkpointer, memoryMiddleware } from "./04_memory.js";

const agentResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      source: z.string(),
      chunkId: z.string(),
      preview: z.string(),
    }),
  ),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;

const NO_ANSWER = "I don't know based on the available documentation.";

const agent = createAgent({
  model: chatModel,
  tools: [createKbSearchTool()],
  systemPrompt: AGENT_SYSTEM_PROMPT,
  responseFormat: providerStrategy(agentResponseSchema),
  checkpointer,
  middleware: [memoryMiddleware],
});

export async function runAgent({
  threadId,
  message,
}: {
  threadId: string;
  message: string;
}): Promise<AgentResponse> {
  const result = await agent.invoke(
    { messages: [["user", message]] },
    {
      configurable: { thread_id: threadId },
      runName: "policy-agent",
      tags: ["policy-agent"],
    },
  );

  return result.structuredResponse ?? { answer: NO_ANSWER, citations: [] };
}
