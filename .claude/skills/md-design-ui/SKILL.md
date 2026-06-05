---
name: md-design-ui
description: Use to author a correct **Claude Design prompt** (the agent's MAIN job) for a pixel-art Memory Galaxy screen/component — the owner runs the generation — then spec the generated result. Produces the prompt (on the issue) + a dated handoff spec in docs/design/. Used by the ui-designer agent.
---

# md-design-ui — SDLC design phase

**The main job is to author a correct, complete prompt for Claude Design** — the design-generation
tool — so the **owner** can run the generation and get a mockup that matches intent on the first
try. *You craft the prompt; the owner generates.* You do **not** auto-write Figma / generate into a
shared workspace yourself (see `memory: claude-design-delegation-flow`). After the owner generates,
you turn the result into a buildable spec.

## When to use
Before implementing any screen or component of the **pixel-art "Memory Galaxy"**. **Every design is
pixel-art — there is no non-pixel-art case** (owner rule, 2026-06-05: "be pixel-art stylish in each
case"). Pixel-art is a hard constraint of every prompt you write.

## The deliverable
### 1 · The Claude Design prompt (PRIMARY artifact)
A complete, self-contained generation prompt the owner pastes into Claude Design. It MUST encode:
- **Pixel-art style — always, explicitly.** The canonical rule (`docs/research/2026-06-02-pixel-art-style.md`):
  **canvas = pixel-pure** (crisp grid, limited palette, no anti-aliased gradients on the pixel
  layer); **DOM memory-jewels + chrome = soft glow**. State the pixel grid/resolution feel, the
  limited palette, crisp edges, the retro star-map look — and the ASTRO mascot + soft-glow galaxy.
- **The design intent** — the screen/component, its purpose, the real content (labels/copy, never
  lorem), pulled from the brief / mockup / PRD.
- **The existing design system** — palette + tokens (`docs/design/2026-06-03-design-tokens.md`), the
  amber default + mood colors, the chrome/layout language, the breadcrumb, ASTRO. So generation stays
  consistent with what's shipped, not a fresh aesthetic.
- **Layout · states · responsiveness** — concrete frame, the states, hover/focus, reduced-motion.
- **Constraints** — SSR-safe, the galaxy canvas stage, accessibility (contrast/focus/keyboard/
  reduced-motion), i18n (en + ru).
- **References** — the source mockup image + any prior generated files.
Keep it tight, unambiguous, reproducible. A weak prompt = a wrong mockup = wasted owner generation.

### 2 · The handoff spec (AFTER generation)
Once the owner has generated, read the result back and complete a buildable `docs/design/` spec.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- The source mockup/brief + `docs/pixel-galaxy-ui.md` + the PRD in `docs/product/*`.
- **`docs/research/2026-06-02-pixel-art-style.md`** — the canonical pixel-art style rule (always honor).
- `docs/design/2026-06-03-design-tokens.md` + the visual-language / critique docs; the `stardust/`
  handoff (gitignored) if the work is mocked there.

## Procedure
1. **Gather intent + style.** Study the mockup/brief, the pixel-art style rule, and the existing
   tokens/visual language so the prompt builds on what's shipped.
2. **Author the Claude Design prompt** (the main artifact) per §1 — pixel-art baked in, real content,
   existing tokens, constraints, references.
3. **Hand off for generation.** Attach the prompt to the issue (durable) and put it in the design
   spec. **The owner runs Claude Design.** Do NOT call `create_new_file`/`use_figma` to generate into
   a shared workspace yourself; confirm before any outward Figma write.
4. **Spec the generated result.** After generation: `get_design_context` / `get_screenshot` /
   `get_variable_defs`; save previews under `docs/img/preview/` (never repo root). Write
   `docs/design/YYYY-MM-DD-<slug>.md` from the template — layout, components mapped to Radix/Tailwind
   v4, states, tokens, a11y, i18n. **Recreate the output** in React/TS — never copy generated code.
5. **Log** the decision-log entry.

## Output
A **Claude Design prompt** (on the issue + in the spec) + a dated `docs/design/` handoff spec ready
for `md-create-story` / `md-implement`. The generation source URL is linked once the owner has run it.

## Delegates to
`superpowers:brainstorming` (intent); **Claude Design** — *owner-run* generation, the agent only
authors the prompt; the Figma MCP **read** tools (`get_design_context`, `get_screenshot`,
`get_variable_defs`) to spec the generated result; `playwright` MCP for inspecting running states.

## Done when
The Claude Design prompt is complete, **pixel-art**, and attached to the issue; after generation a
developer can build from the spec without opening the source; a11y + i18n are specified; the prompt /
generated source is linked.
