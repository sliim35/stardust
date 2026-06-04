---
name: md-design-ui
description: Use to produce a UX/UI spec from the stardust/ Claude Design handoff, a freshly generated Claude Design / Figma mockup, or a product brief, before implementing any visual feature. Produces a dated spec in docs/design/. Used by the ui-designer agent.
---

# md-design-ui — SDLC design phase

Translate a design — the existing `stardust/` handoff, a **freshly generated Claude Design /
Figma mockup**, or a hand-designed screen — into a buildable spec the developer can implement.

## When to use
Before implementing any screen or component. The product is the pixel-art "Memory Galaxy".

## Where the design comes from (pick the cheapest that fits)
1. **Existing `stardust/` handoff** — the original Claude Design export already in the repo
   (`stardust/project/`). Read it and spec it. Best when the work is already mocked there.
2. **Delegate to Claude Design / Figma (generative)** — when the work is **not** in the handoff
   (a new screen, a component, a visual variation, or a few options to compare). Let **Claude
   Design** do the visual generation via the **Figma MCP**, review it with the owner, then bring
   it back as a spec. This is the "we can delegate some work to Claude Design and use it" path —
   `stardust/` was itself a Claude Design export, so this just continues that loop.
3. **Hand-design** via `superpowers:frontend-design` — when neither fits (small/bespoke UI).

All three converge on the **same deliverable**: a `docs/design/` spec. The Figma / Claude Design
file is the *source*; the dated spec is the durable handoff (and issues duplicate what must survive).

## Inputs (read first)
- The `stardust/` handoff (gitignored): `stardust/README.md` + `stardust/project/*`.
- `docs/pixel-galaxy-ui.md` (the UI contract/brief) and the relevant PRD in `docs/product/*`.
- **`docs/research/2026-06-02-pixel-art-style.md`** — the canonical pixel-art **style rule**
  (*canvas = pixel-pure; DOM memory-jewels + chrome = soft glow*) and the amber-vs-green palette
  decision. Every galaxy spec should honor it and stay consistent with the agent-owned mood colors.

## Procedure
1. **Choose the source** (above), then study or generate the design.
   - *Reading a Figma / Claude Design source:* `get_design_context`, `get_screenshot`,
     `get_metadata`, `get_variable_defs` (pull real tokens/measurements, don't eyeball).
   - *Generating / iterating in Claude Design (Figma):* **invoke the `/figma-use` skill first
     (MANDATORY before `use_figma`)**, then `use_figma`; use `/figma-generate-design` to turn an
     app page/layout into a Figma design, or `create_new_file` for a fresh file. **Confirm with the
     owner before writing into a shared Figma workspace** — it is outward-facing.
   - **Save any preview/variant screenshots (`get_screenshot`, `browser_take_screenshot`) under
     `docs/img/preview/` — never the repo root** (AGENTS.md § Conventions). When you show the
     owner 2–3 real variants to pick from, that's where the captures live.
2. **Design the production version** with `superpowers:frontend-design` (distinctive, non-generic,
   accessible). Recreate in React/TS — never copy prototype/Figma code verbatim (recreate the
   *output*, per the handoff README + ADR-0002 §2).
3. **Write** using `.claude/skills/templates/design-spec.md` → `docs/design/YYYY-MM-DD-<slug>.md`:
   layout, components (mapped to Radix/Tailwind v4), states, tokens, a11y, and a buildable handoff.
   Put the Figma / Claude Design URL in the spec's `source:` frontmatter so it's traceable.
4. **Log** the decision-log entry.

## Output
`docs/design/YYYY-MM-DD-<slug>.md` ready for `md-create-story` / `md-implement`.

## Delegates to
`superpowers:frontend-design`, `superpowers:brainstorming`; **Claude Design via the Figma MCP**
(`/figma-use`, `/figma-generate-design`, `use_figma`, `create_new_file`, `get_design_context`,
`get_variable_defs`, …) and the `playwright` MCP for inspecting running states.

## Done when
A developer can build the UI from the spec without opening the prototype/Figma, a11y is specified
(contrast, focus, keyboard, reduced-motion), and — if the design was generated — the Claude Design /
Figma source URL is linked in the spec.
