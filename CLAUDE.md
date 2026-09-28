# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project structure

Two independent npm packages, not a monorepo (no workspace config, no root `package.json`):
- `backend/` — Node/TypeScript, Express, LangChain, MongoDB Atlas Vector Search, OpenAI embeddings
- `client/` — Next.js (App Router), Tailwind v4, shadcn/ui scaffolded (`components.json`) but not yet used — no `components/`/`hooks/` dirs exist yet

## Backend: RAG ingestion pipeline (`backend/src/kb/`)

Files follow a `NN_name.ts` step-numbering convention (`01_loaders.ts`, `02_splitter.ts`, `03_vectorStore.ts`, ...), each with a `// step N -> <what this stage does>` header comment. Keep new pipeline steps in this pattern.

Import conventions established in this codebase — follow them for new files:
- Relative imports use explicit `.js` extensions even though `moduleResolution` is `bundler` (e.g. `from "../utils/mongodb.js"`)
- Import from the most specific `@langchain/*` subpackage (e.g. `@langchain/core/documents`, `@langchain/textsplitters`) rather than the top-level `langchain` package, to avoid pulling in the whole framework
- Default to no comments; add one only when it captures non-obvious rationale (a workaround, a subtle invariant), not what the code already says

## Backend: agent (`backend/src/agent/`)

Same `NN_name.ts` step convention (`01_policy.ts` prompts + `NO_ANSWER`, `02_nodes.ts` graph nodes and edge functions, `03_agents.ts` state + graph + `runAgent`, `04_memory.ts` checkpointer). The agent is a LangGraph `StateGraph` compiled once at module level with a `MongoDBSaver` checkpointer keyed by `thread_id`:

```
START → summarize → router ─┬─ general → general_answer → END
                            └─ kb → retrieve ─┬─ chunks found → kb_answer → END
                                      ▲       ├─ none, attempts < 3 → rewrite_query ─┘
                                              └─ none, attempts = 3 → no_answer → END
```

- `router` is a structured-output classifier (`kb` | `general`). It defaults to `kb` when unsure, on error, and on schema failure; `general` is only for chit-chat, general knowledge, and questions about the conversation itself. Both paths share one `messages` history.
- The KB path always retrieves (`retrieveChunks`, `MIN_RELEVANCE_SCORE = 0.5`). An empty result triggers an LLM query rewrite, up to 3 searches total, then the fixed `NO_ANSWER` string with `route: "kb"`. There is no fallback to a general answer for KB-routed questions.
- `summarize` runs first each turn: past ~4000 tokens it replaces all but the last 10 messages with one summary message. It also resets the per-turn fields (`queries`, `contexts`, `answer`, `citations`), which the checkpointer would otherwise carry into the next turn.
- Each LLM call passes a `runName` (`route`, `kb_answer`, ...). The Phoenix instrumentation names the child LLM span after the model, not the `runName`, so the faithfulness eval finds KB answers by their `<contexts>` block instead.

Chat contract, `POST /api/v1/agents/chat`: request `{ threadId?, message }`, response `{ threadId, answer, citations, route }` where `route` is `"kb"` or `"general"` (general answers return `citations: []`). The server generates `threadId` (nanoid) when omitted; the client sends only the new message and the checkpointer holds the history.

## Required environment variables (backend)

Validated by a zod schema in `backend/src/utils/env.ts` — fails fast with `process.exit(1)` if missing:
`OPENAI_API_KEY`, `MONGODB_ATLAS_URI`, `MONGODB_DB_NAME` (required), `PORT` (defaults to 5000).

## Known gaps / WIP state

- Memory lives in the `checkpoints` / `checkpoint_writes` collections and expires after 2 days idle (sliding TTL). Changing `MEMORY_TTL_SECONDS` later makes `checkpointer.setup()` report an index conflict, and startup exits 1 until the old TTL index is dropped.
- An unknown `threadId` silently starts a fresh conversation (no 404). There is no auth or thread ownership, so anyone who knows a `threadId` can continue that thread.
- The Mongo Atlas Vector Search index (`kb_vector_index`, referenced in `03_vectorStore.ts`) must be created manually in the Atlas UI/CLI — no code path creates it.
- No ESLint/Prettier/Biome config anywhere in the repo.
- No CI configured.

## Testing

No strict TDD default — use judgment on when a test earns its place. `backend` has vitest wired up (`backend/vitest.config.ts`, tests under `backend/test/`, mirroring `src/`'s structure). `client` has no test setup at all.

## Shipping changes

Use the `push-and-merge` skill (`.claude/skills/push-and-merge/`) to branch, commit, push, open a PR against `master`, and merge it — this is a one-person repo with a fast-merge convention (no waiting on review/CI).
