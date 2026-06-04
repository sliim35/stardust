---
name: md-implement
description: Use to implement a story test-first and verify before claiming done. Touches src/ + tests and updates the story status. Used by the developer agent. Delegates the engineering process to the test-driven-development skill.
---

# md-implement — SDLC implementation phase

Build the story with TDD. This skill is a thin SDLC wrapper — the **process is TDD**.

## When to use
When a story has acceptance criteria, a design/architecture shape, and is the next
prioritized item. No story → don't start (loop back to `md-create-story`).

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- The story `docs/stories/<id>-*.md` and everything in its `links:` (PRD, ADR, design).
- `docs/architecture/overview.md`, the **learned conventions** in
  `docs/conventions/code-style.md` (apply them up front so the reviewer doesn't re-flag them),
  and `AGENTS.md` conventions.
- **`docs/` is gitignored → absent in a fresh git worktree.** If you isolate (step 2), read
  these via the **main-repo absolute path**, not the worktree cwd. Only committed files
  (`AGENTS.md`, `src/`, configs) are guaranteed present in a worktree — so conventions that
  must reach the worktree live in `AGENTS.md`.

## Procedure
1. **Set status** `in-progress` (story frontmatter + issue `status:in-progress`).
2. **Isolate** if the change is non-trivial: use the superpowers `using-git-worktrees` skill.
   (Remember: `docs/` won't exist in the worktree — read it via the main-repo path.)
3. **TDD**: use the superpowers `test-driven-development` skill — write a failing test per
   acceptance criterion first, then the minimum code to pass, then refactor. For a
   multi-step story, follow the plan via `executing-plans` / `subagent-driven-development`.
4. **When stuck**, use `systematic-debugging` — don't guess-patch.
5. **Verify locally**: `pnpm check` (Biome) and `pnpm test` (Vitest) must pass.
6. **Record**: append approach + files touched to the story's *Implementation notes*; set
   status `in-review`. Commit with the trailer
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Output
Source + tests; story at `in-review`; clean `pnpm check && pnpm test`.

## Delegates to
`superpowers:test-driven-development` (core), `using-git-worktrees`, `executing-plans`,
`subagent-driven-development`, `systematic-debugging`.

## Done when
Every AC has a passing test, `pnpm check && pnpm test` are green, and notes are recorded.
Hand to `md-review-pr` (reviewer), then `md-qa-review` — do NOT self-mark done.
