---
name: md-create-story
description: Use to slice a PRD/epic into a self-contained story and open its matching GitHub issue. Produces docs/stories/<id>-*.md and a gh issue. Used by the task-creator agent.
---

# md-create-story — SDLC story-creation phase

Produce a self-contained unit of work that a developer can pick up cold.

## When to use
After a PRD (and architecture/design where relevant) exists and work needs slicing.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- `docs/product/*` (scope slices), `docs/architecture/adr/*`, `docs/design/*`.

## Procedure
1. **Slice** the scope into small, independently shippable stories with **testable**
   acceptance criteria. One story = one issue.
2. **Open the GitHub issue first** (if a remote exists) so we get the number — but
   **check for an existing match first (idempotency):** `gh issue list --state all --search
   "<key title terms>"` and scan `docs/stories/*`; if an issue/story already covers this slice,
   **update it instead of opening a duplicate**. Otherwise create it:
   `gh issue create --title "<title>" --body "<goal + AC>" --label "type:story,priority:P?,role:dev,status:todo"`.
   The issue body MUST duplicate goal + acceptance criteria (the durable record — `docs/` is gitignored).
   *If no remote exists yet,* skip this and use a `draft-<slug>` id; add the story to
   `scripts/sdlc/seed-backlog.sh` so it's created once `gh repo create` is run.
3. **Write the story** using `.claude/skills/templates/story.md` →
   `docs/stories/<issue#-or-draft>-<slug>.md`; fill `links:` to the PRD/ADR/design.
4. **Cross-link**: put the story-doc path in the issue body; put the issue URL in the
   story frontmatter. Rename `draft-*` → `<issue#>-*` once the issue exists.

## Output
`docs/stories/<id>-<slug>.md` + a GitHub issue (or a seed-script entry).

## Delegates to
`gh` CLI. (No superpowers process needed — this is glue.)

## Done when
The story stands alone (goal, AC, links), the issue mirrors it, and ids match.
