import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "../../src/agent/03_agents.js";
import { agentsRouter } from "../../src/routes/agents.js";

vi.mock("../../src/agent/03_agents.js", () => ({ runAgent: vi.fn() }));

const runAgentMock = vi.mocked(runAgent);
const agentResponse = { answer: "Sam", citations: [] };

type ChatBody = { threadId: string; answer: string };

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/agents", agentsRouter);

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/agents`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  runAgentMock.mockReset();
  runAgentMock.mockResolvedValue(agentResponse);
});

function chat(body: unknown) {
  return fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /chat", () => {
  it("returns 400 when message is missing or empty", async () => {
    expect((await chat({})).status).toBe(400);
    expect((await chat({ message: "" })).status).toBe(400);
    expect(runAgentMock).not.toHaveBeenCalled();
  });

  it("generates a threadId when omitted and returns it with the answer", async () => {
    const res = await chat({ message: "My name is Sam" });
    const body = (await res.json()) as ChatBody;

    expect(res.status).toBe(200);
    expect(body.threadId).toEqual(expect.any(String));
    expect(body.threadId.length).toBeGreaterThan(0);
    expect(body.answer).toBe("Sam");
    expect(runAgentMock).toHaveBeenCalledWith({
      threadId: body.threadId,
      message: "My name is Sam",
    });
  });

  it("echoes a supplied threadId and passes it through", async () => {
    const res = await chat({ threadId: "thread-1", message: "What's my name?" });
    const body = (await res.json()) as ChatBody;

    expect(res.status).toBe(200);
    expect(body.threadId).toBe("thread-1");
    expect(runAgentMock).toHaveBeenCalledWith({
      threadId: "thread-1",
      message: "What's my name?",
    });
  });

  it("returns 500 when runAgent rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    runAgentMock.mockRejectedValue(new Error("boom"));

    const res = await chat({ message: "hi" });

    expect(res.status).toBe(500);
  });
});
