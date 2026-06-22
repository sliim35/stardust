---
name: md-design-ui
description: Use to author a correct, high-quality **Claude Design prompt** (the agent's MAIN job) for any Memory Galaxy artifact — pixel-art sprite, UI screen, or line-constellation figure — the owner runs the generation, then you spec the result. Carries a research-backed generic prompt template + a figure-specific checklist + verify-by-render. Produces the prompt (on the issue) + a dated handoff spec in docs/design/. Used by the ui-designer agent.
---

# md-design-ui — SDLC design phase (+ Claude Design prompt craft)

**The main job is to author a correct, complete Claude Design prompt** — so the **owner** can run
the generation and get a result that matches intent on the **first try**. *You craft the prompt;
the owner generates* (`memory: claude-design-delegation-flow`). You do **not** auto-generate into a
shared Figma workspace yourself. After the owner generates, you turn the result into a buildable
spec — and for anything geometric/visual you **verify it by render before sign-off** (the prompt
guarantees intent, never the build).

A weak prompt = a wrong mockup = a wasted owner generation. The structure below is research-backed
(`docs/research/2026-06-22-claude-design-prompting.md`, #240) — follow it; don't re-discover it.

## When to use
Before implementing any screen, component, sprite, or figure of the **Memory Galaxy**. Aesthetic
rule (owner, 2026-06-05): **background/cosmos = sleek soft-glow; CHARACTERS (ASTRO) = pixel-art**
— the contrast is the atmosphere (`memory: pixel-art-always`). Match the medium to the artifact
(see "Three artifact families" — they need *different* prompt shapes).

## Know the tool, so the prompt matches it
Claude Design is Anthropic's **interactive-HTML-prototype** generator (Claude.ai Design tab,
Figma-integrated via the `mcp__claude_ai_Figma__*` tools). Three consequences shape every prompt:
- **It defaults to a clickable prototype.** Anything that is *not* an app screen — a **pixel
  sprite** or a **connect-the-dots figure diagram** — must **explicitly redeclare the medium**
  ("NOT a prototype, NOT a sprite, NOT a shaded illustration"), or you get a styled web component
  instead of the artifact you wanted. **Declaring the medium is the #1 lever.**
- **Generated code is not production-ready** and design-system extraction is *inferential*. We
  **recreate** the output in React/TS (never copy generated code) and we **verify by render**.
- **Precision scales with complexity.** A landing page tolerates a loose prompt; a 4-figure
  geometry sheet or a multi-state screen **fails without detailed specs**. Harder artifact → more
  of the structure below.

## How to write the prompt — the generic spine + the high-leverage rules
Structure the prompt as a **creative brief**, not a sentence. Use the **TC-EBC** spine and
front-load the critical instructions:

1. **Task** — what to generate, and *in what medium* (declare + exclude the wrong medium).
2. **Context** — why / for whom / where it lives (prevents drift); the existing design system
   (palette + tokens `docs/design/2026-06-03-design-tokens.md`, chrome language, breadcrumb, ASTRO)
   so generation builds on what's shipped, not a fresh aesthetic.
3. **Elements** — the concrete parts inventory (components, nodes, sprite frames…).
4. **Behavior** — states / interactions (hover, focus, reduced-motion) where applicable.
5. **Constraints** — the guardrails: medium, palette, exact counts, frame/size, SSR-safe, a11y
   (contrast/focus/keyboard), i18n (en + ru).

Then apply the three highest-leverage moves (research-backed) on top of TC-EBC:
- **Anchor the bar with a known-good reference.** "Reads as X the way a smile reads as joy."
  Cite an artifact that *already reads* (e.g. the joyful `smile` / tender `heart` in `seed.ts`).
- **Affirmative target first; anti-pattern only as a paired guard.** Naming "no anchor" alone can
  *summon* an anchor (the negation problem) — so say what it **is**, then name the failure to
  avoid. Keep anti-patterns **few, specific, subject-matched**; over-constraining loses the intent.
- **Pin every concrete number to its source requirement.** Counts/thresholds/sizes must **equal**
  what the **BR/PRD** states — derive them, never pick a "nicer" value behind a `>=` allowance. If a
  design reason pushes past the requirement, call the deviation out **explicitly** and flag it for
  owner sign-off. The Joy smile shipped **14 anchors against a BR of 10** this way (#232/#233): the
  gate read `>=10`, so the drift was invisible until the owner caught it visually. (This is the
  same contract `md-review-pr` traces spec→BR for and `md-qa-review` verifies the render against.)

Also: **real content, never lorem**; **direct language** (cut "maybe/just/please"); **critical
instructions first**, bulk context before the specific ask; on **revisions, state what must NOT
change** so a fix doesn't regress what already reads.

## Three artifact families — each needs a different prompt shape
| Family | The prompt must additionally nail | Failure if omitted |
|---|---|---|
| **A · Pixel-art sprite** (ASTRO) | Medium = **pixel-pure**: crisp grid, fixed resolution/cell feel, **limited palette** (list the swatches), **no anti-aliased gradients on the pixel layer**, transparent bg; the **pose / expression frames** (`memory: astro-emotion-variant-a-approved`). | Comes back a soft-glow illustration or a vector icon, not a sprite. |
| **B · UI screen / component** | Full TC-EBC: frame + responsive rules, the **state set**, the **shipped tokens/chrome**, **a11y**, **i18n** (en+ru, real copy). Chrome = Tailwind utilities, not hardcoded styles (`memory: chrome-tailwind-not-styles-css`). | Fresh aesthetic ignoring tokens; missing states; untranslatable text. |
| **C · Line-constellation figure** (emotion figures) | A *different output entirely*: a **clean connect-the-dots star-chart diagram — NOT pixel art, NOT a sprite, NOT shaded, NOT an HTML prototype.** Correctness is **geometric + semantic** — see the figure checklist below. | The #239 result: shapes that don't read + geometry that can't be transcribed. |

**A (sprite) and C (figure) are opposite prompt shapes** — a sprite is pixel-pure raster; a figure
is a thin-line geometry diagram. Never reuse a sprite prompt for a figure or vice-versa.

## Figure-prompt checklist (family C) — the 7 elements that make a figure read + build
Every emotion/line-constellation figure prompt MUST bake in all seven (each is a known prompting
lever; #240):

1. **Explicit target shape per figure + the at-a-glance bar** — "reads as X the way a smile reads
   as joy." (specificity + known-good reference)
2. **The anti-pattern named, paired with the affirmative target** — e.g. "HOPE = a *sprout*
   reaching up … AVOID an anchor (no downward hook/crossbar/ring)." Affirmative first, guard
   second — never negation alone. (negation-problem mitigation)
3. **Hard structural constraints = the figure contract, pinned** — **exactly N node-stars** (= the
   figure's anchor count, **10** today — *not* "≥10"), **explicit edges over node ids**, **one
   emotion = one colour** (single-colour by construction), the **host galaxy**
   (`hostGalaxyFor(emotion)`). (constraints; pins out the #232/#233 drift)
4. **Render-context constraints** — must read at the **host disk tilt / foreshortening** and in its
   **corner placement**. Andromeda's disk is **steeply tilted** (`realdata.ts` tilt **0.42**, ~77°
   → ~58% vertical squash) → figures it hosts (nostalgic/hope/wonder) must favour **open / tall**
   shapes and not rely on fine vertical detail; Triangulum (0.9) is near face-on; home/LMC 0.74.
5. **A known-good reference to anchor the bar** — the joyful `smile` + tender `heart` in
   `CONSTELLATIONS` (`src/lib/galaxy/seed.ts`) already read; cite them as the legibility bar.
6. **A transcribable output format** — a panel sheet, each figure = **numbered node-dots 1..N**
   (tiny labels) + **every connecting line shown**, captioned name + target shape, one colour per
   figure — so `(r,angle)` anchors + the edge list can be **read off the image deterministically**
   into `ConstellationFigure` (`anchors` + `edges`, see `types.ts`).
7. **A mandatory verify-by-render step** — after the geometry is transcribed + wired into
   `CONSTELLATIONS`, **render at the host tilt + screenshot + confirm it reads** (BR30 gate-2) before
   the story is claimed done. *The prompt guarantees intent; the render guarantees the build.*

## Worked example — the #239 figure prompt (the reference pattern)
This re-generation prompt produced figures that read (after the first batch failed). Note how it
hits every checklist item; the **full verbatim 4-figure prompt is on issue #239** — the skeleton +
two worked figures below show the pattern:

```
Create a CLEAN CONSTELLATION REFERENCE DIAGRAM (a star-map "connect-the-dots" figure sheet) —
NOT pixel art, NOT a sprite, NOT a shaded illustration.            ← (1) DECLARE THE MEDIUM

GOAL: emotion "constellation figures". Each must read UNMISTAKABLY as a target shape, the way a
smile reads as joy and a heart reads as love.                      ← (1)+(5) ANCHOR THE BAR
Each figure = EXACTLY 10 node-stars connected by thin straight line-segments.   ← (3) PINNED COUNT

LAYOUT: 2×2 grid on deep near-black sky (#04050d). Number every node 1–10 with a tiny label;
caption each panel with NAME + TARGET SHAPE; one accent colour per figure (lines + dots same hue).
                                                                  ← (6) TRANSCRIBABLE OUTPUT

2) HOPE — a SPROUT (new growth reaching up). A vertical stem from a low base, TWO young leaves
   branching off and CURVING UPWARD, tips above their branch point; symmetric, all energy UP.
   AVOID: an ANCHOR — no downward hook, no crossbar, no ring at the bottom.   ← (2) AFFIRMATIVE + GUARD

3) PEACEFUL — a CRESCENT MOON. An outer lit arc + a smaller inner shadow arc meeting at two horn
   points top and bottom. AVOID a symmetric leaf/almond and any centre vein line.   ← (2)

HARD CONSTRAINTS: exactly 10 node-dots per figure; straight segments only; show every line; one
figure = one colour (hex given). Keep it a precise LINE DIAGRAM — no pixel-art, no sprite, no
shaded fill, no nebula clutter.                                    ← (3) THE CONTRACT, PINNED
Make shapes legible even if squashed vertically (one host galaxy is steeply tilted): give NOSTALGIC
and HOPE generous height / open curves so they survive vertical compression.   ← (4) RENDER-CONTEXT
```

After generation: transcribe nodes → `(r,angle)` anchors + the edge list, wire into
`CONSTELLATIONS`, then **(7)** render at the host tilt + screenshot + confirm it reads.

## The deliverable
### 1 · The Claude Design prompt (PRIMARY artifact)
A complete, self-contained generation prompt (per the spine + the right family shape) the owner
pastes into Claude Design. Attach it to the **issue** (durable) and put it in the design spec.

### 2 · The handoff spec (AFTER generation)
Read the result back and complete a buildable `docs/design/YYYY-MM-DD-<slug>.md` from the template.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- `docs/research/2026-06-22-claude-design-prompting.md` (this skill's research basis) +
  `docs/research/2026-06-02-pixel-art-style.md` (the canonical pixel-art rule — always honour).
- The source mockup/brief + `docs/pixel-galaxy-ui.md` + the PRD in `docs/product/*`.
- `docs/design/2026-06-03-design-tokens.md` + the visual-language / critique docs; the `stardust/`
  handoff (gitignored) if the work is mocked there. For figures: `seed.ts` known-good references +
  the figure contract (`types.ts`, `figure-verification.test.ts`).

## Procedure
1. **Gather intent + style + family.** Study the brief, the pixel-art rule, the shipped tokens, and
   decide the artifact family (A/B/C) — it sets the prompt shape.
2. **Author the Claude Design prompt** (the main artifact) — TC-EBC spine, declare the medium,
   anchor the bar, affirmative-first anti-patterns, pin numbers to the BR, the family's extra needs;
   for figures, walk the 7-element checklist.
3. **Hand off for generation.** Attach the prompt to the issue + the spec. **The owner runs Claude
   Design.** Do NOT call `create_new_file`/`use_figma` to generate yourself; confirm before any
   outward Figma write.
4. **Spec the generated result.** `get_design_context` / `get_screenshot` / `get_variable_defs`;
   save previews under `docs/img/preview/` (never repo root). Write the spec — layout, components
   mapped to Radix/Tailwind v4, states, tokens, a11y, i18n. **Recreate** in React/TS; pin every
   concrete number to its source requirement and flag any deviation for owner sign-off.
5. **Verify by render (close the loop).** For any geometric/visual result — especially figures —
   render it at the host context (the figure's host disk tilt) + screenshot + confirm it reads
   against the reference (BR30 gate-2). Never claim done from the prompt alone; never rationalize an
   off render into a pass (`memory: galaxy-visual-qa-by-shape`; consistent with `md-qa-review`).
6. **Log** the decision-log entry and post the prompt/decision to the issue.

## Output
A **Claude Design prompt** (on the issue + in the spec) + a dated `docs/design/` handoff spec ready
for `md-create-story` / `md-implement`, with the generation source URL linked once the owner runs
it, and (for visual/figure work) a render screenshot proving it reads.

## Delegates to
`superpowers:brainstorming` (intent); **Claude Design** — *owner-run* generation, the agent only
authors the prompt; the Figma MCP **read** tools (`get_design_context`, `get_screenshot`,
`get_variable_defs`) to spec the result; `playwright` MCP for inspecting / screenshotting running
states (the verify-by-render loop).

## Done when
The Claude Design prompt is complete, **matches the artifact family** (medium declared), anchors the
bar, pins every number to the BR, and is attached to the issue; after generation a developer can
build from the spec without opening the source; a11y + i18n are specified; for visual/figure work
the result is **verified by render**; the prompt / generated source is linked.
