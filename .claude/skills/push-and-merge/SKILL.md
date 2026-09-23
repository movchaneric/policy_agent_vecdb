---
name: push-and-merge
description: Ship the current changes - branch, commit, push, and open a PR against master. Use when the user says they're ready to push to GitHub, wants to ship/publish their changes, or asks to create a PR. Does NOT merge the PR - that step is manual, done by the user on GitHub.
---

# Push and Merge

Takes the working tree from "changes are ready" to "PR open against master" in one pass: branch, commit, push, PR. This repo's default flow is one PR per unit of work. Merging is **not** automatic: the skill stops once the PR is open and the user merges it themselves on GitHub.

## Steps

### 1. Verify before touching git

Run this repo's checks so broken code never gets pushed:

```
cd backend && npx tsc --noEmit && npx vitest run
```

If either fails, stop and fix it (or ask the user how to proceed) before continuing.

### 2. Get on a branch

Run `git status` and `git branch --show-current`.

- If already on a non-`master` branch: stay on it.
- If on `master`: create a new branch from it. Name it from what actually changed (e.g. `feature/vector-store`, `fix/splitter-metadata`) - don't ask the user to name it unless the change is ambiguous.

### 3. Commit

Review `git status` / `git diff` for anything staged or unstaged. Stage relevant files by name (never `git add -A`), and double-check nothing looks like a secret before committing. Write a commit message describing *why*, following this repo's existing log style (`git log --oneline`). Use the attribution line already established in this conversation/session if one is set; don't invent one.

If there's nothing to commit (working tree already clean, e.g. the user already committed by hand), skip straight to step 4.

### 4. Push

```
git push -u origin <branch>
```

If `gh` reports an auth error (expired token), tell the user to run `gh auth login -h github.com` via `! <command>` and wait - don't try to work around it.

### 5. Open the PR

```
gh pr create --base master --head <branch> --title "<short, specific>" --body "<summary + test plan>"
```

Body should have a `## Summary` (bullets of what changed and why) and a `## Test plan` (the checks from step 1, marked done). End with the PR attribution line from this session's system reminder, if one is set.

### 6. Stop and hand off

Do not merge the PR. Tell the user the PR is open (include the URL `gh pr create` printed) and that they need to go to GitHub and merge it manually themselves.

## Notes

- Merging is always a manual, user-driven step on GitHub - never run `gh pr merge` or otherwise merge/close the PR yourself, even if asked to "ship it" or "finish it up." If the user wants it merged, tell them to do it on GitHub.
- Never force-push, never skip the step-1 checks.
