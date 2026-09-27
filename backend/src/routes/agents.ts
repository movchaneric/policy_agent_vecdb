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
  namespace: z.string().min(1).optional(),
});

agentsRouter.post("/chat", async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error:
        "messages must be a non-empty array of { role, content }, and namespace (if provided) must be a non-empty string",
    });
    return;
  }

  const { messages, namespace } = parsed.data;

  try {
    const response = await runAgent(messages, namespace);
    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: "Something went wrong processing your chat request.",
    });
  }
});
