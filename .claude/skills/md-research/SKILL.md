---
name: md-research
description: Use to run a time-boxed research spike before design — evaluate a library/approach, de-risk an unknown, or answer a "how should we…" question. Produces a dated note in docs/research/. Used by the researcher and architect agents.
---

# md-research — SDLC research phase

Turn an open question into a written finding + recommendation in the knowledge base.

## When to use
Before a PRD or architecture decision, whenever there's a real unknown (new library, API
feasibility, a "which approach" fork). Skip for things you already know.

## Inputs (read first — see references/docs-contract.md)
- The triggering question / story / epic.
- `docs/product/*` and `docs/architecture/overview.md` for context.
- Existing `docs/research/*` (don't redo prior work).

## Procedure
1. **Frame & time-box** the question. For framing options, use the superpowers
   `brainstorming` skill.
2. **Investigate.** For anything substantial, delegate to the superpowers `deep-research`
   skill (fan-out search → fetch → verify → cite). For library/API/CLI docs prefer the
   `context7` MCP tools and, for this stack, `tanstack <cmd> --json`.
3. **Record** using `.claude/skills/templates/research-note.md` →
   `docs/research/YYYY-MM-DD-<slug>.md`. Lead with the TL;DR recommendation.
4. **Log** a one-line entry in `docs/decisions/decision-log.md` if it changes direction.

## Output
`docs/research/YYYY-MM-DD-<slug>.md` with a clear, actionable recommendation + sources.

## Delegates to
`superpowers:deep-research` (investigation), `superpowers:brainstorming` (framing).

## Done when
The next agent can make the decision from the TL;DR without re-researching, and sources are cited.
