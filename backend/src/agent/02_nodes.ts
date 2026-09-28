// step 2 -> the graph nodes and conditional-edge functions behind the policy agent

import {
  AIMessage,
  HumanMessage,
  RemoveMessage,
  SystemMessage,
  getBufferString,
  isHumanMessage,
} from "@langchain/core/messages";
import { REMOVE_ALL_MESSAGES } from "@langchain/langgraph";
import { countTokensApproximately } from "langchain";
import { z } from "zod";
import { retrieveChunks } from "../kb/05_retriever.js";
import { chatModel } from "../utils/openai.js";
import {
  GENERAL_PROMPT,
  KB_ANSWER_PROMPT,
  NO_ANSWER,
  REWRITE_PROMPT,
  ROUTER_PROMPT,
  SUMMARY_PREFIX,
  SUMMARY_PROMPT,
} from "./01_policy.js";
import type { GraphState } from "./03_agents.js";

const PREVIEW_LENGTH = 200;
const MIN_RELEVANCE_SCORE = 0.5;
const RETRIEVE_TOP_K = 8;
const ROUTER_CONTEXT_MESSAGES = 6;
const MAX_SEARCH_ATTEMPTS = 3;
const SUMMARY_TRIGGER_TOKENS = 4000;
const SUMMARY_KEEP_MESSAGES = 10;

const routeSchema = z.object({ route: z.enum(["kb", "general"]) });

const kbAnswerSchema = z.object({
  answer: z.string(),
  citedChunkIds: z.array(z.string()),
});

function latestUserMessage(state: GraphState): string {
  return [...state.messages].reverse().find(isHumanMessage)?.text ?? "";
}

// the checkpointer persists the whole state between turns, so per-turn fields
// must be cleared or turn 2 would inherit turn 1's attempt count and contexts
const TURN_RESET = { queries: [], contexts: [], answer: "", citations: [] };

export async function summarizeNode(state: GraphState) {
  const { messages } = state;
  if (
    messages.length <= SUMMARY_KEEP_MESSAGES ||
    countTokensApproximately(messages) <= SUMMARY_TRIGGER_TOKENS
  ) {
    return { ...TURN_RESET };
  }

  const older = messages.slice(0, -SUMMARY_KEEP_MESSAGES);
  const kept = messages.slice(-SUMMARY_KEEP_MESSAGES);
  const response = await chatModel.invoke(
    [new HumanMessage(SUMMARY_PROMPT.replace("{messages}", getBufferString(older)))],
    { runName: "summarize" },
  );

  // REMOVE_ALL_MESSAGES then re-adding the kept messages puts the summary
  // first; removing only the older ids would append it after the kept ones
  return {
    ...TURN_RESET,
    messages: [
      new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
      new HumanMessage(`${SUMMARY_PREFIX}\n\n${response.text}`),
      ...kept,
    ],
  };
}

export async function routeNode(state: GraphState) {
  const history = state.messages.slice(-ROUTER_CONTEXT_MESSAGES - 1, -1);
  try {
    const result = await chatModel.withStructuredOutput(routeSchema).invoke(
      [
        new SystemMessage(ROUTER_PROMPT),
        new HumanMessage(
          `Recent conversation:\n${getBufferString(history)}\n\nNew message:\n${latestUserMessage(state)}`,
        ),
      ],
      { runName: "route" },
    );
    const parsed = routeSchema.safeParse(result);
    return { route: parsed.success ? parsed.data.route : ("kb" as const) };
  } catch (err) {
    console.error("router failed, defaulting to kb:", err);
    return { route: "kb" as const };
  }
}

export async function retrieveNode(state: GraphState) {
  const queries = state.queries.length ? state.queries : [latestUserMessage(state)];
  const { chunks } = await retrieveChunks(queries[queries.length - 1], {
    k: RETRIEVE_TOP_K,
    scoreThreshold: MIN_RELEVANCE_SCORE,
  });
  return { queries, contexts: chunks };
}

export async function rewriteQueryNode(state: GraphState) {
  const previous = state.queries[state.queries.length - 1];
  const response = await chatModel.invoke(
    [
      new SystemMessage(REWRITE_PROMPT),
      new HumanMessage(
        `Conversation:\n${getBufferString(state.messages.slice(-ROUTER_CONTEXT_MESSAGES))}\n\nQueries already tried:\n${state.queries.map((q) => `- ${q}`).join("\n")}`,
      ),
    ],
    { runName: "rewrite_query" },
  );
  // an empty rewrite would make retrieveChunks throw
  return { queries: [...state.queries, response.text.trim() || previous] };
}

export async function kbAnswerNode(state: GraphState) {
  const contexts = state.contexts
    .map((c) => `[chunkId: ${c.chunkId}] (source: ${c.source})\n${c.text}`)
    .join("\n\n");

  const result = await chatModel.withStructuredOutput(kbAnswerSchema).invoke(
    [
      new SystemMessage(`${KB_ANSWER_PROMPT}\n\n<contexts>\n${contexts}\n</contexts>`),
      ...state.messages,
    ],
    { runName: "kb_answer" },
  );

  const cited = new Set(result.citedChunkIds);
  // chunkId is stringified to match the schema the client receives
  const citations = state.contexts
    .filter((c) => cited.has(String(c.chunkId)))
    .map((c) => ({
      source: c.source,
      chunkId: String(c.chunkId),
      preview: c.text.slice(0, PREVIEW_LENGTH),
    }));

  return {
    messages: [new AIMessage(result.answer)],
    answer: result.answer,
    citations,
  };
}

export async function generalAnswerNode(state: GraphState) {
  const response = await chatModel.invoke(
    [new SystemMessage(GENERAL_PROMPT), ...state.messages],
    { runName: "general_answer" },
  );
  return { messages: [response], answer: response.text, citations: [] };
}

export function selectPath(state: GraphState) {
  return state.route === "general" ? "general_answer" : "retrieve";
}

export function noAnswerNode() {
  return { messages: [new AIMessage(NO_ANSWER)], answer: NO_ANSWER, citations: [] };
}

export function afterRetrieve(state: GraphState) {
  if (state.contexts.length > 0) return "kb_answer";
  return state.queries.length < MAX_SEARCH_ATTEMPTS ? "rewrite_query" : "no_answer";
}
