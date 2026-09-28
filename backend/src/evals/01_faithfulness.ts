// step 1 -> pull LLM spans from Phoenix and flag answers unfaithful to the retrieved KB context

import "dotenv/config";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const PROJECT_NAME = "policy-agent";

interface FlatMessage {
  role: string;
  content: string;
}

function readInputMessages(attrs: Record<string, unknown>): FlatMessage[] {
  const messages: FlatMessage[] = [];
  for (let i = 0; ; i++) {
    const role = attrs[`llm.input_messages.${i}.message.role`];
    if (typeof role !== "string") break;
    const content = attrs[`llm.input_messages.${i}.message.content`];
    messages.push({ role, content: typeof content === "string" ? content : "" });
  }
  return messages;
}

function readContexts(messages: FlatMessage[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  return /<contexts>([\s\S]*?)<\/contexts>/.exec(system)?.[1].trim() ?? "";
}

// kb_answer uses structured output, so the answer is a field of a JSON payload
// (message content or, with function-calling, a tool call's arguments)
function readAnswer(attrs: Record<string, unknown>): string {
  const raw =
    attrs["llm.output_messages.0.message.content"] ||
    attrs["llm.output_messages.0.message.tool_calls.0.tool_call.function.arguments"];
  if (typeof raw !== "string") return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "answer" in parsed && typeof parsed.answer === "string") {
      return parsed.answer;
    }
  } catch {
    // not JSON: fall through to the raw text
  }
  return raw;
}

async function main() {
  const { spans } = await getSpans({
    project: { projectName: PROJECT_NAME },
    spanKind: "LLM",
    limit: 200,
  });

  // grounds the answer against ONLY the retrieved KB context, never the
  // user's own phrasing -- a generic hallucination check treats the user's
  // message as evidence too, which misses a leading/false-premise question.
  // gpt-4o-mini reliably missed entity-identity mismatches (e.g. wrong name
  // attached to otherwise-correct facts) even with clean context; gpt-4o caught
  // them consistently, so the judge model is deliberately not the mini tier.
  const evaluator = createFaithfulnessEvaluator({ model: openai("gpt-4o") });

  const annotations: Parameters<typeof logSpanAnnotations>[0]["spanAnnotations"] = [];

  for (const span of spans) {
    const attrs = span.attributes as Record<string, unknown>;
    const messages = readInputMessages(attrs);

    // only the kb_answer call carries a <contexts> block; the router, rewrite,
    // summarize and general calls have none, so they are skipped here
    const context = readContexts(messages);
    const answer = readAnswer(attrs);
    if (!context || !answer) continue;

    const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const result = await evaluator.evaluate({ input: question, context, output: answer });
    console.log(span.context.span_id, result.label, result.score, result.explanation);

    annotations.push({
      spanId: span.context.span_id,
      name: "faithfulness",
      label: result.label,
      score: result.score,
      explanation: result.explanation,
      annotatorKind: "LLM",
    });
  }

  if (annotations.length) {
    await logSpanAnnotations({ spanAnnotations: annotations, sync: true });
  }

  console.log(`Evaluated ${annotations.length} span(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
