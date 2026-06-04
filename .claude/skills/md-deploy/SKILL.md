---
name: md-deploy
description: Use to build and deploy to Cloudflare Workers after QA sign-off, then close the issue. Also for wrangler/CI/env work. Used by the devops agent.
---

# md-deploy — SDLC delivery phase

Ship the verified work and close the loop.

## When to use
After QA sign-off, or for wrangler/CI/secrets/bindings work.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- The signed-off story and its QA verdict.
- `docs/architecture/overview.md` and `wrangler.jsonc`.

## Procedure
1. **Finish the branch** using the superpowers `finishing-a-development-branch` skill
   (merge/PR decision). Follow `workers-best-practices` and the `wrangler` skill for any
   config.
2. **Build & deploy**: `pnpm build`, then `pnpm deploy` (wrangler). Confirm the deploy
   succeeded (check the workers.dev URL).
3. **Verify live** (smoke test the changed route/behavior).
4. **Close out**: append deploy notes to the story; `gh issue close <#> --comment "deployed: <url>"`;
   set story `status: done`; log the decision-log entry.

## Output
A live deploy + a closed issue + a story marked done.

## Delegates to
`superpowers:finishing-a-development-branch`; `wrangler`, `workers-best-practices`,
`cloudflare` skills; `cloudflare` MCP.

## Done when
The change is live and verified, the issue is closed, and the story is `done`.

> Note: requires a configured git remote / Cloudflare account. During bootstrap neither the
> GitHub remote nor a deploy is created — see `scripts/sdlc/seed-backlog.sh` and the repo
> setup note in AGENTS.md.
