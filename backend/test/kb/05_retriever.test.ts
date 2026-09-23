import { describe, expect, it } from "vitest";
import { Document } from "@langchain/core/documents";
import { retrieveChunks } from "../../src/kb/05_retriever.js";

function fakeVectorStore(results: Array<[Document, number]>) {
  const calls: Array<{ query: string; k: number; filter: unknown }> = [];
  return {
    similaritySearchWithScore: async (
      query: string,
      k: number,
      filter: unknown,
    ) => {
      calls.push({ query, k, filter });
      return results;
    },
    calls,
  };
}

describe("retrieveChunks", () => {
  it("throws when namespace is missing", async () => {
    const store = fakeVectorStore([]);
    await expect(
      retrieveChunks("", "coverage limits?", {}, store),
    ).rejects.toThrow("Namespace is needed");
  });

  it("throws when query is empty", async () => {
    const store = fakeVectorStore([]);
    await expect(
      retrieveChunks("acme", "   ", {}, store),
    ).rejects.toThrow("Query is needed");
  });

  it("pre-filters the vector search by namespace and defaults k to 4", async () => {
    const store = fakeVectorStore([]);

    await retrieveChunks("acme", "what does the policy cover?", {}, store);

    expect(store.calls).toHaveLength(1);
    expect(store.calls[0].query).toBe("what does the policy cover?");
    expect(store.calls[0].k).toBe(4);
    expect(store.calls[0].filter).toEqual({
      preFilter: { namespace: { $eq: "acme" } },
    });
  });

  it("respects a custom k", async () => {
    const store = fakeVectorStore([]);

    await retrieveChunks("acme", "coverage limits?", { k: 2 }, store);

    expect(store.calls[0].k).toBe(2);
  });

  it("maps matched documents and scores into retrieved chunks", async () => {
    const doc = new Document({
      pageContent: "Accidental damage is covered up to $5,000.",
      metadata: { source: "policy.pdf", chunkId: 3, page: 1, namespace: "acme" },
    });
    const store = fakeVectorStore([[doc, 0.87]]);

    const results = await retrieveChunks("acme", "accidental damage", {}, store);

    expect(results).toEqual([
      {
        text: "Accidental damage is covered up to $5,000.",
        score: 0.87,
        source: "policy.pdf",
        chunkId: 3,
        metadata: doc.metadata,
      },
    ]);
  });

  it("filters out matches below the score threshold", async () => {
    const weakDoc = new Document({
      pageContent: "irrelevant",
      metadata: { source: "policy.pdf", chunkId: 0 },
    });
    const strongDoc = new Document({
      pageContent: "relevant",
      metadata: { source: "policy.pdf", chunkId: 1 },
    });
    const store = fakeVectorStore([
      [strongDoc, 0.9],
      [weakDoc, 0.3],
    ]);

    const results = await retrieveChunks(
      "acme",
      "query",
      { scoreThreshold: 0.5 },
      store,
    );

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("relevant");
  });
});
