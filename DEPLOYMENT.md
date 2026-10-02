# Deployment

| | dev | prod |
|---|---|---|
| Trigger | merge to `master` | push a tag `vX.Y.Z` (must be on `master`) |
| Workflow | `.github/workflows/deploy-dev.yml` | `.github/workflows/release.yml` |
| Client | Cloudflare Worker `policy-agent-dev` | Cloudflare Worker `policy-agent` |
| Backend | Render `policy-agent-api-dev` | Render `policy-agent-api-prod` |
| Mongo database | `agent_kb_dev` | `agent_kb` |
| GitHub environment | `dev` | `production` |

PRs to `master` run `ci.yml` (backend lint/tsc/tests/build, client lint/tsc/OpenNext build). Both deploy workflows run it first and only deploy if it passes.

## Releasing

```
git checkout master && git pull
git tag v1.0.0 && git push origin v1.0.0
```

The workflow deploys that commit to prod and publishes a GitHub Release with generated notes. To roll back, push a new tag on an older good commit (or re-run an earlier release run).

## One-time setup

1. **Render**: create both services from `render.yaml` (New > Blueprint). Set `OPENAI_API_KEY` and `MONGODB_ATLAS_URI` on each. Copy each service's *Deploy Hook* URL (Settings).
2. **Atlas**: Network Access must allow Render (free tier has no fixed IPs, so `0.0.0.0/0`). For each database (`agent_kb_dev`, `agent_kb`) create the `kb_vector_index` Vector Search index on `kb_chunks` by hand, as for local dev.
3. **Cloudflare**: create an API token with the *Edit Cloudflare Workers* template and note your account id.
4. **GitHub > Settings > Environments**: create `dev` and `production`. In each add:
   - secrets `RENDER_DEPLOY_HOOK_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - variable `API_URL` (that environment's Render service URL, no trailing slash)
   - optional on `production`: required reviewers, so prod deploys wait for approval
5. **Branch protection** on `master`: require the `CI` checks to pass before merging.

## Notes

- `NEXT_PUBLIC_API_URL` is inlined at build time, so the client is rebuilt on every deploy using the environment's `API_URL`.
- The Render deploy hook is called with `ref=<commit sha>` so the service builds exactly the commit that passed CI. Confirm this on the first run.
- Render free services sleep when idle; the first request after a pause is slow.
