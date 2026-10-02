# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project structure

Two independent npm packages, not a monorepo (no workspace config, no root `package.json`):
- `backend/` — Node/TypeScript, Express, LangChain, MongoDB Atlas Vector Search, OpenAI embeddings
- `client/` — Next.js (App Router), Tailwind v4, Claude-style chat UI (sidebar of conversations, markdown answers with expandable citations, knowledge-base upload dialog). Plain Tailwind components; `components.json` is scaffolded but no shadcn components are installed. Conversations are persisted in `localStorage` (`src/lib/store.ts`) because the backend exposes no history endpoint; the local conversation id is the backend `threadId`. Backend URL comes from `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`; set `client/.env.local` to match the backend `PORT`)

## Backend: RAG ingestion pipeline (`backend/src/kb/`)

Files follow a `NN_name.ts` step-numbering convention (`01_loaders.ts`, `02_splitter.ts`, `03_vectorStore.ts`, ...), each with a `// step N -> <what this stage does>` header comment. Keep new pipeline steps in this pattern.

Import conventions established in this codebase — follow them for new files:
- Relative imports use explicit `.js` extensions even though `moduleResolution` is `bundler` (e.g. `from "../utils/mongodb.js"`)
- Import from the most specific `@langchain/*` subpackage (e.g. `@langchain/core/documents`, `@langchain/textsplitters`) rather than the top-level `langchain` package, to avoid pulling in the whole framework
- Default to no comments; add one only when it captures non-obvious rationale (a workaround, a subtle invariant), not what the code already says

## Backend: agent (`backend/src/agent/`)

Same `NN_name.ts` step convention (`01_policy.ts`, `02_tools.ts`, `03_agents.ts`, `04_memory.ts`). Step 4 is conversation memory: a `MongoDBSaver` checkpointer keyed by `thread_id` plus `summarizationMiddleware` (summarizes past ~4000 tokens, keeps the last 10 messages). The agent is built once at module level with both.

A single tool-calling agent decides per message whether to call `kb_search`, per its two-mode system prompt (`AGENT_SYSTEM_PROMPT` in `01_policy.ts`): **KB mode** for anything the knowledge base could answer (product docs, pricing, policies, or a specific person/company/document), always calling `kb_search` and answering only from its contexts, defaulting to KB mode when unsure; **general mode** for chit-chat, general knowledge, and questions about the conversation itself, answered from history with no tool call and `citations: []`. This replaced an earlier prompt that said to use ONLY the documentation with no general mode, which made the agent refuse questions the checkpointer's own history could already answer (e.g. "what is my name?"). `kb_search` (`02_tools.ts`) retrieves the top 8 chunks (`RETRIEVE_TOP_K`) above `MIN_RELEVANCE_SCORE = 0.5` — a KB with more than one similar document (e.g. two CVs) needs more than the top 4, or one document's chunks can crowd out another's.

A LangGraph router/workflow rewrite of this agent (explicit `kb`/`general` routing nodes instead of a single prompt) was implemented and then reverted — see `git log --oneline -- backend/src/agent` for that commit and its revert.

Chat contract, `POST /api/v1/agents/chat`: request `{ threadId?, message }`, response `{ threadId, answer, citations }`. The server generates `threadId` (nanoid) when omitted; the client sends only the new message and the checkpointer holds the history.

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
