import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveChunks, type RetrievedChunk } from "../../src/kb/05_retriever.js";
import { runAgent } from "../../src/agent/03_agents.js";

// Each LLM call in the graph is tagged with a runName; the fake model routes to
// the matching handler so tests script the model per graph node.
const llm = vi.hoisted(() => ({
  route: vi.fn(),
  rewrite_query: vi.fn(),
  kb_answer: vi.fn(),
  general_answer: vi.fn(),
  summarize: vi.fn(),
}));

type LlmNode = keyof typeof llm;

vi.mock("../../src/utils/openai.js", () => {
  const call = (input: unknown, config?: { runName?: string }) =>
    llm[config?.runName as LlmNode](input);
  return {
    chatModel: {
      invoke: call,
      withStructuredOutput: () => ({ invoke: call }),
    },
  };
});

vi.mock("../../src/agent/04_memory.js", async () => {
  const { MemorySaver } = await import("@langchain/langgraph");
  return { checkpointer: new MemorySaver() };
});

vi.mock("../../src/kb/05_retriever.js", () => ({ retrieveChunks: vi.fn() }));

const retrieveChunksMock = vi.mocked(retrieveChunks);

const NO_ANSWER = "I don't know based on the available documentation.";

let threadCounter = 0;
const newThreadId = () => `thread-${++threadCounter}`;

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    text: "Premium costs $20 per month.",
    score: 0.9,
    source: "pricing.pdf",
    chunkId: 7,
    metadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  for (const handler of Object.values(llm)) handler.mockReset();
  retrieveChunksMock.mockReset();
});

describe("runAgent", () => {
  it("answers a documentation question from retrieved chunks, with citations", async () => {
    llm.route.mockResolvedValue({ route: "kb" });
    retrieveChunksMock.mockResolvedValue({ chunks: [chunk()], confidence: 0.9 });
    llm.kb_answer.mockResolvedValue({
      answer: "Premium costs $20 per month.",
      citedChunkIds: ["7"],
    });

    const result = await runAgent({
      threadId: newThreadId(),
      message: "How much is premium?",
    });

    expect(result).toEqual({
      answer: "Premium costs $20 per month.",
      citations: [
        { source: "pricing.pdf", chunkId: "7", preview: "Premium costs $20 per month." },
      ],
      route: "kb",
    });
    expect(retrieveChunksMock).toHaveBeenCalledWith("How much is premium?", {
      k: 8,
      scoreThreshold: 0.5,
    });
  });

  it("truncates citation previews to 200 characters", async () => {
    llm.route.mockResolvedValue({ route: "kb" });
    retrieveChunksMock.mockResolvedValue({
      chunks: [chunk({ text: "a".repeat(300) })],
      confidence: 0.9,
    });
    llm.kb_answer.mockResolvedValue({ answer: "aaa", citedChunkIds: ["7"] });

    const result = await runAgent({ threadId: newThreadId(), message: "q" });

    expect(result.citations[0].preview).toBe("a".repeat(200));
  });

  it("answers a general question without searching the docs, with no citations", async () => {
    llm.route.mockResolvedValue({ route: "general" });
    llm.general_answer.mockResolvedValue(new AIMessage("Hi there!"));

    const result = await runAgent({ threadId: newThreadId(), message: "hello" });

    expect(result).toEqual({ answer: "Hi there!", citations: [], route: "general" });
    expect(retrieveChunksMock).not.toHaveBeenCalled();
  });

  it("remembers a fact from an earlier turn on the same thread", async () => {
    const threadId = newThreadId();
    llm.route.mockResolvedValue({ route: "general" });
    llm.general_answer
      .mockResolvedValueOnce(new AIMessage("Nice to meet you, Ed."))
      .mockImplementationOnce(async (messages: BaseMessage[]) => {
        const seen = messages.map((m) => m.text).join("\n");
        return new AIMessage(seen.includes("My name is Ed") ? "Your name is Ed." : "No idea.");
      });

    await runAgent({ threadId, message: "My name is Ed" });
    const result = await runAgent({ threadId, message: "what is my name?" });

    expect(result.answer).toBe("Your name is Ed.");
  });

  describe("router fallback", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      retrieveChunksMock.mockResolvedValue({ chunks: [chunk()], confidence: 0.9 });
      llm.kb_answer.mockResolvedValue({ answer: "Premium costs $20.", citedChunkIds: ["7"] });
    });

    it("defaults to the kb route when the classifier throws", async () => {
      llm.route.mockRejectedValue(new Error("classifier down"));

      const result = await runAgent({ threadId: newThreadId(), message: "hello" });

      expect(result.route).toBe("kb");
      expect(retrieveChunksMock).toHaveBeenCalled();
    });

    it("defaults to the kb route when the classifier returns an invalid value", async () => {
      llm.route.mockResolvedValue({ route: "banana" });

      const result = await runAgent({ threadId: newThreadId(), message: "hello" });

      expect(result.route).toBe("kb");
    });
  });

  describe("retry with a rewritten query", () => {
    const noChunks = { chunks: [], confidence: 0.2 };

    beforeEach(() => {
      llm.route.mockResolvedValue({ route: "kb" });
    });

    it("rewrites the query after an empty retrieval and answers from the second attempt", async () => {
      retrieveChunksMock
        .mockResolvedValueOnce(noChunks)
        .mockResolvedValueOnce({ chunks: [chunk()], confidence: 0.8 });
      llm.rewrite_query.mockResolvedValue(new AIMessage("premium plan monthly price"));
      llm.kb_answer.mockResolvedValue({ answer: "Premium costs $20.", citedChunkIds: ["7"] });

      const result = await runAgent({ threadId: newThreadId(), message: "what's the cost?" });

      expect(retrieveChunksMock.mock.calls.map(([query]) => query)).toEqual([
        "what's the cost?",
        "premium plan monthly price",
      ]);
      expect(result.answer).toBe("Premium costs $20.");
      expect(result.route).toBe("kb");
    });

    it("gives up after three failed attempts with the fixed no-answer message", async () => {
      retrieveChunksMock.mockResolvedValue(noChunks);
      llm.rewrite_query
        .mockResolvedValueOnce(new AIMessage("second query"))
        .mockResolvedValueOnce(new AIMessage("third query"));

      const result = await runAgent({ threadId: newThreadId(), message: "obscure question" });

      expect(result).toEqual({ answer: NO_ANSWER, citations: [], route: "kb" });
      expect(retrieveChunksMock.mock.calls.map(([query]) => query)).toEqual([
        "obscure question",
        "second query",
        "third query",
      ]);
      expect(llm.rewrite_query).toHaveBeenCalledTimes(2);
      expect(llm.kb_answer).not.toHaveBeenCalled();
    });
  });

  it("starts each turn with a fresh attempt count on the same thread", async () => {
    const threadId = newThreadId();
    llm.route.mockResolvedValue({ route: "kb" });
    llm.rewrite_query.mockResolvedValue(new AIMessage("rewritten"));
    retrieveChunksMock
      .mockResolvedValueOnce({ chunks: [], confidence: 0.1 })
      .mockResolvedValueOnce({ chunks: [], confidence: 0.1 })
      .mockResolvedValueOnce({ chunks: [], confidence: 0.1 })
      .mockResolvedValueOnce({ chunks: [chunk()], confidence: 0.9 });
    llm.kb_answer.mockResolvedValue({ answer: "Premium costs $20.", citedChunkIds: ["7"] });

    await runAgent({ threadId, message: "first question" });
    const second = await runAgent({ threadId, message: "How much is premium?" });

    expect(retrieveChunksMock.mock.calls[3][0]).toBe("How much is premium?");
    expect(second.answer).toBe("Premium costs $20.");
    expect(llm.rewrite_query).toHaveBeenCalledTimes(2);
  });

  describe("summarizing long history", () => {
    const longAnswer = () => new AIMessage("x".repeat(4000));

    beforeEach(() => {
      llm.route.mockResolvedValue({ route: "general" });
      llm.general_answer.mockImplementation(async () => longAnswer());
    });

    it("leaves history alone while it is short, even if it is token-heavy", async () => {
      const threadId = newThreadId();

      for (let i = 0; i < 4; i++) await runAgent({ threadId, message: `q${i}` });

      expect(llm.summarize).not.toHaveBeenCalled();
    });

    it("replaces all but the last 10 messages with one summary once history passes ~4000 tokens", async () => {
      const threadId = newThreadId();
      llm.summarize.mockResolvedValue(new AIMessage("Ed likes tea."));

      // five turns = 10 messages, ~5000 tokens; the sixth turn has 11 messages
      for (let i = 0; i < 6; i++) await runAgent({ threadId, message: `q${i}` });

      expect(llm.summarize).toHaveBeenCalledTimes(1);
      const [, ...history] = llm.general_answer.mock.calls[5][0] as BaseMessage[];
      const texts = history.map((m) => m.text);
      expect(texts).toHaveLength(11);
      expect(texts[0]).toContain("Ed likes tea.");
      expect(texts).not.toContain("q0");
      expect(texts[1]).toBe("x".repeat(4000));
      expect(texts[10]).toBe("q5");
    });
  });
});
