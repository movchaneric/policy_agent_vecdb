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

## Required environment variables (backend)

Validated by a zod schema in `backend/src/utils/env.ts` — fails fast with `process.exit(1)` if missing:
`OPENAI_API_KEY`, `MONGODB_ATLAS_URI`, `MONGODB_DB_NAME` (required), `PORT` (defaults to 5000).

## Known gaps / WIP state

- `backend/src/index.ts` is currently empty — no Express server is wired up yet, despite express/cors/multer being installed.
- The Mongo Atlas Vector Search index (`kb_vector_index`, referenced in `03_vectorStore.ts`) must be created manually in the Atlas UI/CLI — no code path creates it.
- No ESLint/Prettier/Biome config anywhere in the repo.
- No CI configured.

## Testing

No strict TDD default — use judgment on when a test earns its place. `backend` has vitest wired up (`backend/vitest.config.ts`, tests under `backend/test/`, mirroring `src/`'s structure). `client` has no test setup at all.

## Shipping changes

Use the `push-and-merge` skill (`.claude/skills/push-and-merge/`) to branch, commit, push, open a PR against `master`, and merge it — this is a one-person repo with a fast-merge convention (no waiting on review/CI).
