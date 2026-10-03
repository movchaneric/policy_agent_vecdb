# Release flow: local -> dev -> prod

One-time setup (Render, Atlas, Cloudflare, GitHub environments) is in `DEPLOYMENT.md`. This guide covers the day-to-day flow.

```
feature branch -> PR to master -> merge -> DEV (auto) -> tag vX.Y.Z -> PROD
```

## How the workflows are triggered

The workflows run on GitHub's servers, not on your machine. What you do locally only triggers them.

| Workflow | Triggered by | Result |
|---|---|---|
| `ci.yml` | opening or updating a PR to `master` | checks only, no deploy |
| `deploy-dev.yml` | a merge to `master` (a push to `master`) | deploys to dev |
| `release.yml` | pushing a `vX.Y.Z` tag | deploys to prod |

- Pushing a branch or opening a PR does not deploy anything. Only merging to `master` does.
- Nothing "moves" dev to prod. The tag points at a commit already on `master` (the same commit dev has), and `release.yml` rebuilds that commit from scratch with the prod `API_URL`, Worker and Render service. Prod does not reuse dev's build.

## 1. Local -> dev

1. Branch from an up-to-date `master`:
   ```
   git checkout master && git pull
   git checkout -b feature/my-change
   ```
2. Work and test locally (`backend/` and `client/` run independently; see `CLAUDE.md`).
3. Commit, push, and open a PR against `master`. The `push-and-merge` skill does this in one go.
4. `ci.yml` runs on the PR (backend lint/tsc/tests/build, client lint/tsc/build). Wait for green.
5. Merge the PR into `master`.
6. `deploy-dev.yml` triggers automatically:
   - re-runs CI
   - calls the Render `policy-agent-api-dev` deploy hook
   - rebuilds the client with the dev `API_URL` and deploys it to Cloudflare Worker `policy-agent-dev`
7. Track it under GitHub > Actions > **Deploy dev**.

Every merge to `master` deploys to dev. There is no manual step.

## 2. Verify on dev

Before promoting, check dev:

- Backend: open `https://policy-agent-api-dev.onrender.com/api-docs`. Render free tier sleeps when idle, so the first request can take ~50s.
- Frontend: open the dev `*.workers.dev` URL, upload a document, send a chat message, check the answer and citations.
- Dev uses the `agent_kb_dev` database. It is separate from prod, so test documents don't leak across.

## 3. Dev -> prod

Prod deploys when you push a version tag on a `master` commit. There are no prod or release branches.

```
git checkout master && git pull
git tag v1.0.1
git push origin v1.0.1
```

`release.yml` then:
- runs CI
- calls the Render `policy-agent-api-prod` deploy hook
- rebuilds the client with the prod `API_URL` and deploys it to Cloudflare Worker `policy-agent`
- publishes a GitHub Release with generated notes

Track it under Actions > **Release (prod)**.

### Choosing the version

- Patch (`v1.0.1`): bug fix
- Minor (`v1.1.0`): new feature, backward compatible
- Major (`v2.0.0`): breaking change

### Tagging a specific commit

The tag must point at a commit that is on `master`:
```
git tag v1.0.1 <commit-sha>
git push origin v1.0.1
```

## 4. Roll back prod

Push a new tag on an older good commit:
```
git tag v1.0.2 <good-commit-sha>
git push origin v1.0.2
```
Or re-run an earlier successful **Release (prod)** run from the Actions tab.

## 5. Fix a bad tag

If you pushed a tag by mistake before the workflow finished, cancel the run in Actions, then:
```
git push origin --delete v1.0.1
git tag -d v1.0.1
```
If the deploy already finished, don't delete the tag. Roll forward or back with a new tag (section 4).

## Optional safeguards

- **Approval before prod:** GitHub > Settings > Environments > `production` > Required reviewers. Tag pushes then wait for approval.
- **Block red merges:** branch protection on `master` requiring the `CI` checks.

## Quick reference

| Step | Where | Result |
|---|---|---|
| PR to `master` | GitHub | CI only, no deploy |
| Merge to `master` | GitHub | auto-deploy to dev |
| Push tag `vX.Y.Z` | git | deploy to prod |
| Rollback | new tag on old commit | deploy to prod |
