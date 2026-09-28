import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { runAgent } from "../agent/03_agents.js";

export const agentsRouter = Router();

const chatRequestSchema = z.object({
  threadId: z.string().min(1).optional(),
  message: z.string().min(1),
});

agentsRouter.post("/chat", async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "body must be { threadId?: string, message: string } with a non-empty message",
    });
    return;
  }

  const { message } = parsed.data;
  const threadId = parsed.data.threadId ?? nanoid();

  try {
    const response = await runAgent({ threadId, message });
    res.status(200).json({ threadId, ...response });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: "Something went wrong processing your chat request.",
    });
  }
});
