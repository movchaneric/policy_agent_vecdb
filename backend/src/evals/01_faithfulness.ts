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

async function main() {
  const { spans } = await getSpans({
    project: { projectName: PROJECT_NAME },
    spanKind: "LLM",
    limit: 200,
  });

  // only the turn that produced the final answer has finish_reason "stop";
  // the earlier tool-calling turn has no answer yet to judge
  const finalAnswerSpans = spans.filter(
    (span) => (span.attributes as Record<string, unknown>)["llm.finish_reason"] === "stop",
  );

  if (!finalAnswerSpans.length) {
    console.log("No final-answer LLM spans found.");
    return;
  }

  // grounds the answer against ONLY the retrieved kb_search context, never the
  // user's own phrasing -- a generic hallucination check treats the user's
  // message as evidence too, which misses a leading/false-premise question.
  // gpt-4o-mini reliably missed entity-identity mismatches (e.g. wrong name
  // attached to otherwise-correct facts) even with clean context; gpt-4o caught
  // them consistently, so the judge model is deliberately not the mini tier.
  const evaluator = createFaithfulnessEvaluator({ model: openai("gpt-4o") });

  const annotations: Parameters<typeof logSpanAnnotations>[0]["spanAnnotations"] = [];

  for (const span of finalAnswerSpans) {
    const attrs = span.attributes as Record<string, unknown>;
    const messages = readInputMessages(attrs);

    const question = messages.find((m) => m.role === "user")?.content ?? "";
    const context = messages
      .filter((m) => m.role === "tool")
      .map((m) => m.content)
      .join("\n");
    const answer =
      typeof attrs["llm.output_messages.0.message.content"] === "string"
        ? (attrs["llm.output_messages.0.message.content"] as string)
        : "";

    if (!context || !answer) continue;

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
