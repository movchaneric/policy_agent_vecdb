import { Router } from "express";
import { z } from "zod";
import { runAgent } from "../agent/03_agents.js";

export const agentsRouter = Router();

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

agentsRouter.post("/chat", async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "messages must be a non-empty array of { role, content }",
    });
    return;
  }

  const { messages } = parsed.data;

  try {
    const response = await runAgent(messages);
    res.status(200).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    res.status(500).json({ ok: false, error: message });
  }
});
