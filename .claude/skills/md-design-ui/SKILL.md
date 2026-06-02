---
name: md-design-ui
description: Use to produce a UX/UI spec from the stardust/ Claude Design handoff or a product brief, before implementing any visual feature. Produces a dated spec in docs/design/. Used by the ui-designer agent.
---

# md-design-ui — SDLC design phase

Translate the design handoff into a buildable spec the developer can implement.

## When to use
Before implementing any screen or component. The product is pixel-art "Memory Galaxy".

## Inputs (read first)
- The `stardust/` handoff (gitignored, local): `stardust/README.md` and the prototype files
  in `stardust/project/` (Memory Galaxy.html, galaxy.jsx, memory-ui.jsx, scopes.jsx, …).
- `docs/pixel-galaxy-ui.md` (the UI contract/brief).
- The relevant PRD in `docs/product/*`.

## Procedure
1. **Study the prototype**, then design the production version using the superpowers
   `frontend-design` skill (distinctive, non-generic, accessible). Use the `playwright` MCP
   to inspect the running prototype or compare states when useful. Recreate the design in
   React/TS — do not copy-paste prototype code.
2. **Write** using `.claude/skills/templates/design-spec.md` →
   `docs/design/YYYY-MM-DD-<slug>.md`: layout, components (mapped to Radix/Tailwind v4),
   states, tokens, a11y, and a buildable handoff (props/data/route).
3. **Log** the decision-log entry.

## Output
`docs/design/YYYY-MM-DD-<slug>.md` ready for `md-create-story` / `md-implement`.

## Delegates to
`superpowers:frontend-design`, `superpowers:brainstorming`; `playwright` + `Figma` MCP tools.

## Done when
A developer can build the UI from the spec without opening the prototype, and a11y is specified.
