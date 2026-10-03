# Policy Agent

A RAG chat agent over your own documents. Upload PDFs, Markdown or text files to a knowledge base, then ask questions in a chat UI. Answers come with expandable citations. The agent decides per message whether to search the knowledge base or answer from the conversation.

```
Browser -> Next.js UI (Cloudflare Workers) -> Express API (Render) -> MongoDB Atlas Vector Search + OpenAI
```

## Repository layout

Two independent npm packages. There is no root `package.json` and no workspace config, so install and run each one on its own.

| Path | What it is |
|---|---|
| `backend/` | Node 22 / TypeScript, Express, LangChain, MongoDB Atlas Vector Search, OpenAI |
| `client/` | Next.js (App Router), Tailwind v4, chat UI with sidebar, markdown answers and upload dialog |
| `render.yaml` | Render Blueprint for the dev and prod backend services |
| `.github/workflows/` | `ci.yml`, `deploy-dev.yml`, `release.yml` |

More detail on the architecture and conventions is in [`CLAUDE.md`](CLAUDE.md).

## Environments

There are two deployed environments plus your local machine.

| | local | dev | prod |
|---|---|---|---|
| Deployed by | you | merge to `master` | push a `vX.Y.Z` tag |
| Backend | `localhost:5000` | Render `policy-agent-api-dev` | Render `policy-agent-api-prod` |
| Client | `localhost:3000` | Cloudflare Worker `policy-agent-dev` | Cloudflare Worker `policy-agent` |
| Mongo database | your own | `agent_kb_dev` | `agent_kb` |
| GitHub environment | n/a | `dev` | `production` |

## Running locally

### Prerequisites

- Node.js 22
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (the free tier works). Add your IP under Network Access.
- Optional: [Arize Phoenix](https://github.com/Arize-ai/phoenix) running on `localhost:6006` for tracing and evals

### 1. Atlas vector index (manual, one time)

No code path creates this index. In the Atlas UI, create a **Vector Search** index on your database's `kb_chunks` collection:

- Index name: `kb_vector_index`
- Field: `embedding`, type `vector`
- Dimensions: `1536` (the model is `text-embedding-3-small`)
- Similarity: `cosine`

The collection is created on the first upload. If the index UI needs it to exist first, create an empty `kb_chunks` collection.

### 2. Backend

```
cd backend
npm install
```

Create `backend/.env`:

```
OPENAI_API_KEY=sk-...
MONGODB_ATLAS_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
MONGODB_DB_NAME=agent_kb_local
PORT=5000
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

`OPENAI_API_KEY`, `MONGODB_ATLAS_URI` and `MONGODB_DB_NAME` are required. The server validates them at startup (`backend/src/utils/env.ts`) and exits with code 1 if any is missing. `PORT` defaults to 5000 and `PHOENIX_COLLECTOR_ENDPOINT` to `http://localhost:6006`.

```
npm run dev
```

The API docs are at `http://localhost:5000/api-docs`.

### 3. Client

```
cd client
npm install
```

Create `client/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

It must match the backend `PORT`. Then:

```
npm run dev
```

Open `http://localhost:3000`, upload a document with the upload dialog, and start chatting.

## API

All routes are under the `/api/v1` prefix.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/kb/upload` | Upload a PDF, Markdown or text file and ingest it into the knowledge base |
| `POST` | `/api/v1/agents/chat` | Request `{ threadId?, message }`, response `{ threadId, answer, citations }` |

The server generates a `threadId` when you omit it. The client sends only the new message, and conversation memory lives server-side in MongoDB (`checkpoints` collections, 2 day sliding TTL). The client stores its conversation list in `localStorage`.

## Development workflow

### Commands

Backend (`backend/`):

| Command | What it does |
|---|---|
| `npm run dev` | Run with hot reload (`tsx watch`) |
| `npm run build` / `npm start` | Compile to `dist/` and run it (what Render does) |
| `npm test` | Run the vitest suite (tests are in `backend/test/`, mirroring `src/`) |
| `npm run lint` | ESLint |
| `npm run evals` | Score answer faithfulness from Phoenix traces (needs Phoenix running) |
| `npx tsc --noEmit` | Type check |

Client (`client/`): `npm run dev`, `npm run build`, `npm run lint`. The client has no test setup yet.

### Code conventions

- Pipeline files are numbered `NN_name.ts` (`01_loaders.ts`, `02_splitter.ts`, ...), each with a `// step N -> <what this stage does>` header. Keep new steps in this pattern.
- Relative imports use explicit `.js` extensions, for example `from "../utils/mongodb.js"`.
- Import from the most specific `@langchain/*` subpackage (for example `@langchain/core/documents`), not the top-level `langchain` package.
- Mount all Express routes under `/api/v1/...`.
- Default to no comments. Add one only for non-obvious rationale.

### Contributing

1. Fork the repo and branch from an up-to-date `master` (`feature/...`, `fix/...`, `docs/...`).
2. Make your change. Run the backend checks before pushing:
   ```
   cd backend && npx tsc --noEmit && npm run lint && npm test
   ```
3. Open a PR against `master`. `ci.yml` runs the backend lint, type check, tests and build, and the client lint, type check and build. It needs to pass.
4. Once a maintainer merges it, it deploys to dev automatically.

## Deploying and releasing

- **Day-to-day flow** (PR, merge to dev, tag to prod, rollback): [`RELEASE_FLOW.md`](RELEASE_FLOW.md)
- **One-time setup** (Render services, Atlas, Cloudflare token, GitHub environments and secrets): [`DEPLOYMENT.md`](DEPLOYMENT.md)

In short: merging to `master` deploys dev. Pushing a `vX.Y.Z` tag on a `master` commit deploys prod.

```
git checkout master && git pull
git tag v1.0.1
git push origin v1.0.1
```

Contributors don't need any of the deploy credentials. Only maintainers set up the Render, Cloudflare and GitHub secrets.

## Known limitations

- No authentication. Anyone who knows a `threadId` can continue that thread, and an unknown `threadId` silently starts a new conversation.
- Render's free tier sleeps when idle, so the first request after a pause is slow.
- Changing `MEMORY_TTL_SECONDS` makes startup fail on an index conflict until the old TTL index is dropped in Atlas.
- No license file has been added yet.
