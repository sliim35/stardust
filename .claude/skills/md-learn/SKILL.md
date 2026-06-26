---
name: md-learn
description: Use after a story merges (or at the end of a meaty session) to distill what the work *taught* — corrections, decisions, recurring workflows, preferences, gotchas — and route each finding to its sink (docs/, memory, a flagged convention, or a new-skill gap), writing nothing until the human ratifies. The deliberate, routed counterpart to the automatic `dream` hook; the loop's final retro step. Used by the `md-workflow` mediator.
---

# md-learn — SDLC learning / retro phase

Distill what a unit of work *taught* and route it to the right home, so the next session
starts smarter. The deliberate, ratified counterpart to the automatic `dream` memory hook —
md-learn also feeds `docs/` and surfaces **skill gaps**, and it writes **nothing** until the
human approves.

## When to use
After `devops`/`md-deploy` closes an issue (a story merged) — the loop's final retro step.
Also on-demand at the end of a meaty session. Skip trivial / no-learning work.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- **The session dialog** — the corrections, decisions, and workflow this session actually ran
  (the primary source; "reveal new patterns from the dialog").
- The merged story `docs/stories/<id>-*.md` + its **Code review** and **QA verdict** sections.
- Records to dedupe against: `MEMORY.md` (+ `memory/`), `docs/decisions/decision-log.md`,
  `docs/conventions/code-style.md`, `AGENTS.md`.

## Procedure
1. **Harvest.** Scan the dialog/session for learnings: (a) **corrections** the human made;
   (b) **decisions** + their rationale; (c) **recurring workflows / preferences**; (d) **gotchas /
   failures + the fix**; (e) anything that surprised. Keep the actionable; note its evidence (where
   in the work it showed up).
2. **Classify & route** each learning to exactly one sink:

   | Learning | Sink | Form |
   |---|---|---|
   | project decision / rationale | `docs/` | a `decision-log` line · research note · ADR pointer |
   | durable cross-session fact / preference | **memory** | a `memory/<slug>.md` (type: `user`·`feedback`·`project`·`reference`) + a `MEMORY.md` pointer |
   | convention / style rule | **flag → `md-review-pr`** | do **not** write `code-style.md` yourself — hand the signal over |
   | recurring workflow worth codifying | **skill gap** | propose a new/updated `md-*` skill or agent; open an issue |
   | one-off / already captured | **drop** | — |

3. **Dedupe.** Drop anything already in `MEMORY.md`, the decision-log, or the guide. Never re-add;
   if an existing record needs *updating*, name the target file instead of adding a duplicate.
4. **Present a digest** for ratification — a `finding → sink → proposed action` table. The human
   approves / edits / drops each row. **Write nothing yet.**
5. **Apply (only what was approved).** Write the `docs/` artifacts; write/update the `memory/` files
   (delegate the file shape to the `dream` skill) + the `MEMORY.md` pointer; open issues for skill
   gaps; append **one** `decision-log` line summarizing the learn pass.

## Output
Ratified `docs/` + `memory/` updates, issues for any skill gaps, and a one-line decision-log entry.
Nothing is written without approval (step 4).

## Delegates to
`dream` (memory-file format/write + prune/index hygiene); `md-review-pr` (owns conventions —
**flag, don't write**); `gh` (skill-gap issues).

## Done when
Every actionable learning is routed + recorded (or consciously dropped), nothing is duplicated, and
the human ratified the writes. The loop is closed; the next session starts smarter.
