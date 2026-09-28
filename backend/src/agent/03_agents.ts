// step 3 -> the graph state, the graph that routes and answers each message, and runAgent

import { Annotation, END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import type { RetrievedChunk } from "../kb/05_retriever.js";
import { NO_ANSWER } from "./01_policy.js";
import {
  afterRetrieve,
  generalAnswerNode,
  kbAnswerNode,
  noAnswerNode,
  retrieveNode,
  rewriteQueryNode,
  routeNode,
  selectPath,
  summarizeNode,
} from "./02_nodes.js";
import { checkpointer } from "./04_memory.js";

export interface Citation {
  source: string;
  chunkId: string;
  preview: string;
}

export type Route = "kb" | "general";

export interface AgentResponse {
  answer: string;
  citations: Citation[];
  route: Route;
}

const lastValue = <T>(initial: () => T) =>
  Annotation<T>({ reducer: (_, next) => next, default: initial });

const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  route: lastValue<Route>(() => "kb"),
  queries: lastValue<string[]>(() => []),
  contexts: lastValue<RetrievedChunk[]>(() => []),
  answer: lastValue<string>(() => ""),
  citations: lastValue<Citation[]>(() => []),
});

export type GraphState = typeof GraphAnnotation.State;

const graph = new StateGraph(GraphAnnotation)
  .addNode("summarize", summarizeNode)
  .addNode("router", routeNode)
  .addNode("retrieve", retrieveNode)
  .addNode("rewrite_query", rewriteQueryNode)
  .addNode("kb_answer", kbAnswerNode)
  .addNode("no_answer", noAnswerNode)
  .addNode("general_answer", generalAnswerNode)
  .addEdge(START, "summarize")
  .addEdge("summarize", "router")
  .addConditionalEdges("router", selectPath, ["general_answer", "retrieve"])
  .addConditionalEdges("retrieve", afterRetrieve, ["kb_answer", "rewrite_query", "no_answer"])
  .addEdge("rewrite_query", "retrieve")
  .addEdge("kb_answer", END)
  .addEdge("no_answer", END)
  .addEdge("general_answer", END)
  .compile({ checkpointer });

export async function runAgent({
  threadId,
  message,
}: {
  threadId: string;
  message: string;
}): Promise<AgentResponse> {
  const result = await graph.invoke(
    { messages: [["user", message]] },
    {
      configurable: { thread_id: threadId },
      runName: "policy-agent",
      tags: ["policy-agent"],
    },
  );

  return {
    answer: result.answer || NO_ANSWER,
    citations: result.citations,
    route: result.route,
  };
}
