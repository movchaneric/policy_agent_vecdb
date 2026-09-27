// step 3 -> the agent that answers questions by calling kb_search

import { createAgent, providerStrategy } from "langchain";
import { z } from "zod";
import { chatModel } from "../utils/openai.js";
import { createKbSearchTool } from "./02_tools.js";
import { AGENT_SYSTEM_PROMPT } from "./01_policy.js";

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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const NO_ANSWER = "I don't know based on the available documentation.";

function createProductAgent(namespace?: string) {
  return createAgent({
    model: chatModel,
    tools: [createKbSearchTool(namespace)],
    systemPrompt: AGENT_SYSTEM_PROMPT,
    responseFormat: providerStrategy(agentResponseSchema),
  });
}

export async function runAgent(
  messages: ChatMessage[],
  namespace?: string,
): Promise<AgentResponse> {
  const agent = createProductAgent(namespace);

  const result = await agent.invoke({
    messages: messages.map(({ role, content }) => [role, content] as const),
  });

  return result.structuredResponse ?? { answer: NO_ANSWER, citations: [] };
}
