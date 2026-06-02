---
name: md-write-prd
description: Use to capture a product brief / PRD — the problem, users, goals, scope, and success metrics for a feature or product before architecture and stories. Produces a dated doc in docs/product/. Used by the architect and orchestrator agents.
---

# md-write-prd — SDLC product-definition phase

Define the *what & why* before anyone designs the *how*.

## When to use
At the start of a feature/epic, once the problem is understood (often after `md-research`).
Don't write code or pick a stack here — that's `md-plan-architecture`.

## Inputs (read first)
- Research notes in `docs/research/*`.
- For the product itself: `stardust/README.md` and `docs/pixel-galaxy-ui.md`.
- Any user intent captured in the triggering request.

## Procedure
1. **Clarify intent & requirements** using the superpowers `brainstorming` skill — explore
   the problem and constraints before writing.
2. **Write** using `.claude/skills/templates/prd.md` →
   `docs/product/YYYY-MM-DD-<slug>.md`. Be explicit about non-goals and success metrics.
3. **List the scope slices** at the bottom — these become stories via `md-create-story`.
4. **Log** the decision-log entry; link the epic issue # if one exists.

## Output
`docs/product/YYYY-MM-DD-<slug>.md` (status: draft → approved).

## Delegates to
`superpowers:brainstorming` (intent & requirements).

## Done when
A reader knows the problem, who it's for, what's in/out of scope, and how success is measured.
