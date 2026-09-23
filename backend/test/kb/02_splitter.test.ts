import { describe, expect, it } from "vitest";
import { Document } from "@langchain/core/documents";
import { splitDocuments } from "../../src/kb/02_splitter.js";

describe("splitDocuments", () => {
  it("returns a single chunk for a document shorter than the chunk size", async () => {
    const doc = new Document({
      pageContent: "This policy covers accidental damage.",
      metadata: { source: "policy.txt" },
    });

    const chunks = await splitDocuments([doc]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageContent).toBe("This policy covers accidental damage.");
    expect(chunks[0].metadata.chunkId).toBe(0);
  });

  it("splits a document across a paragraph break into sequentially numbered chunks", async () => {
    const firstParagraph = "A".repeat(50);
    const secondParagraph = "B".repeat(50);
    const doc = new Document({
      pageContent: `${firstParagraph}\n\n${secondParagraph}`,
      metadata: { source: "policy.txt" },
    });

    const chunks = await splitDocuments([doc], {
      chunkSize: 60,
      chunkOverlap: 0,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].pageContent).toBe(firstParagraph);
    expect(chunks[0].metadata.chunkId).toBe(0);
    expect(chunks[1].pageContent).toBe(secondParagraph);
    expect(chunks[1].metadata.chunkId).toBe(1);
  });

  it("carries the source document's metadata onto every resulting chunk", async () => {
    const firstParagraph = "A".repeat(50);
    const secondParagraph = "B".repeat(50);
    const doc = new Document({
      pageContent: `${firstParagraph}\n\n${secondParagraph}`,
      metadata: { source: "policy.pdf", page: 2, totalPages: 10 },
    });

    const chunks = await splitDocuments([doc], {
      chunkSize: 60,
      chunkOverlap: 0,
    });

    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(chunk.metadata.source).toBe("policy.pdf");
      expect(chunk.metadata.page).toBe(2);
      expect(chunk.metadata.totalPages).toBe(10);
    }
  });
});
