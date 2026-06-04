---
name: md-plan-architecture
description: Use to design the system shape and record an ADR before non-trivial implementation — tech/stack choices, data model, cross-cutting decisions, new dependencies. Updates docs/architecture/overview.md and writes a numbered ADR. Used by the architect agent.
---

# md-plan-architecture — SDLC architecture phase

Give a feature a technical shape and capture the *why* so it's traceable.

## When to use
Before implementing anything with a non-obvious design, a new dependency, or a
cross-cutting effect. Skip for mechanical changes.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- The PRD in `docs/product/*` and relevant `docs/research/*`.
- `docs/architecture/overview.md` and existing `docs/architecture/adr/*`.
- Repo source and `AGENTS.md` conventions; `tanstack … --json` for framework facts.

## Procedure
1. **Design.** Shape the solution to fit the constraints (TanStack Start, Cloudflare
   Workers, pnpm, the separate vitest config). For the implementation plan itself, use the
   superpowers `writing-plans` skill.
2. **Record the decision** as an ADR using `.claude/skills/templates/adr.md` →
   `docs/architecture/adr/NNNN-<slug>.md` (next sequential number; immutable once Accepted).
3. **Update** `docs/architecture/overview.md` to reflect the new structure.
4. **Index** the ADR in `docs/decisions/decision-log.md`.

## Output
A new `adr/NNNN-*.md` + an updated `overview.md`.

## Delegates to
`superpowers:writing-plans` (implementation plan), `superpowers:brainstorming` (option exploration).

## Done when
The design fits the stack, the ADR states the decision + alternatives + consequences, and
overview.md is current.
