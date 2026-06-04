# The docs/ contract

**Read before you act. Write after you decide.** Every SDLC agent follows this.

## Before acting

1. Read the story you're working (`docs/stories/<id>-*.md`) and follow its `links:` to the
   PRD, ADR(s), and design spec it depends on. The story is meant to be self-contained —
   if it isn't, fix that first (loop back to task-creator).
2. Skim `docs/decisions/decision-log.md` for recent decisions that touch your area, and
   the relevant ADRs in `docs/architecture/adr/`.
3. If you need context that isn't written down, find it and **write it down** before using
   it — that's the point of the substrate.

## After deciding

1. Write/update **your** artifact in the right `docs/` folder, using the matching template
   in `.claude/skills/templates/`.
2. Append a one-line entry to `docs/decisions/decision-log.md` for any decision the next
   agent would need to know.
3. Keep the GitHub issue in sync (status label, a short comment). **The issue is the
   durable record** — `docs/` is local and gitignored, so put anything shareable in the
   issue body/comments, not only in the doc.

## Reachability (worktrees / CI)

`docs/` is **gitignored** — it lives only in the main working copy, **not in fresh git
worktrees or CI**. If you isolate work in a worktree, read/write `docs/` via the **main-repo
absolute path**, not the worktree cwd. Only committed files (`AGENTS.md`, `src/`, configs) are
guaranteed present in a worktree — so a convention that must reach a worktree-isolated developer
belongs in `AGENTS.md`, not only in `docs/conventions/code-style.md`.

## Naming (see docs/README.md)

- Dated artifacts: `YYYY-MM-DD-<kebab>.md`
- ADRs: `NNNN-<kebab>.md`
- Stories: `<issue#>-<kebab>.md` (or `draft-<kebab>.md` pre-issue)

## Don't

- Don't start implementation without a story + acceptance criteria.
- Don't `gh issue create` without first searching open+closed issues for a match (idempotency — avoid duplicates).
- Don't duplicate what a superpowers skill already does — delegate to it.
- Don't edit an Accepted ADR; supersede it with a new one.
