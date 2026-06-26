---
name: md-groom-backlog
description: Use to groom the backlog — prioritize, dedupe, re-label, and reconcile docs/stories with GitHub issues. Reports the next-best item. Used by the backlog-analyzer agent.
---

# md-groom-backlog — SDLC backlog-grooming phase

Keep the backlog honest and tell the `md-workflow` mediator what to do next.

## When to use
On a planning pass, when the backlog drifts, or when asked "what's next?".

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- All `docs/stories/*` frontmatter.
- GitHub issues: `gh issue list --state all --json number,title,labels,state,createdAt`.
- `docs/decisions/decision-log.md`.

## Procedure
1. **Reconcile** stories ↔ issues: every open story has a live issue and vice-versa.
   Flag/fix drift (missing issue, stale `status:*` label, closed issue with `todo` story).
   Also scan merged PRs for **`base ≠ main`** (`gh pr list --state merged --json
   number,baseRefName`) — a hit means stacked-PR content that never reached `main`
   (stranded; recover by cherry-picking the stranded squash onto `main`, cf. #178→#179).
2. **Prioritize**: assign/adjust `priority:P0..P3` based on value, risk, and dependencies.
3. **Dedupe & label**: merge duplicates; ensure each issue has type/priority/status/role labels.
4. **Update** story frontmatter `status` to mirror the issue (issue = source of truth).
5. **Report** the top 1–3 next items and any blockers; log notable re-prioritizations.

## Output
Synced labels/statuses + a short "next up" recommendation (and decision-log entry if priorities moved).

## Delegates to
`gh` CLI.

## Done when
No drift between `docs/stories/*` and issues, labels are complete, and "next up" is clear.
