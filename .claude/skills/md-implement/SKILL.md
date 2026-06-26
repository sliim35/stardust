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
5. **Verify locally**: the unit gate — `pnpm check` (Biome), `pnpm typecheck`, and `pnpm test`
   (Vitest) — must pass.
5a. **Self-review (inline, fast pre-pass)**: before handing off, invoke the `code-review` skill
    (low/medium effort — it runs inline, no sub-agent) on your working diff. **Fix** the findings
    you agree with; push back on the rest via `receiving-code-review`. Re-run the unit gate
    (`pnpm check && pnpm typecheck && pnpm test`). This catches the obvious before the formal
    `reviewer` phase — it does **not** replace it. **Simplification is a downstream mediator
    phase** (`code-simplifier`, run by `md-workflow`); if you are running `md-implement`
    **standalone** (no mediator), invoke the `simplify` skill yourself before opening the PR.
6. **Record**: append approach + files touched to the story's *Implementation notes*; set
   status `in-review`. Commit with the trailer
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
7. **Address review** (after `md-review-pr` posts comments): handle **every** thread before
   merge — answer it **first**, *then* resolve. Never resolve a thread unanswered, even nits.
   **Accept** → reply with what changed + the commit sha; **reject** → reply with the technical
   why (delegate the rigor to `superpowers:receiving-code-review`). Reply **and** resolve as the
   review bot via `scripts/sdlc/bot-token.sh` (verify the author login — the token expires
   ~hourly); inline threads are invisible to `gh pr view`, so read/reply/resolve through the
   GraphQL `reviewThreads` API. Fold fixes into the PR as a new commit and re-run
   `pnpm check && pnpm test`.

## Output
Source + tests; story at `in-review`; clean `pnpm check && pnpm test`.

## Delegates to
`superpowers:test-driven-development` (core), `using-git-worktrees`, `executing-plans`,
`subagent-driven-development`, `systematic-debugging`, `receiving-code-review` (review loop),
`code-review` (the step-5a self-pass). Downstream, the `md-workflow` mediator runs `simplify`
(`code-simplifier`) before the `reviewer` phase.

## Done when
Every AC has a passing test, `pnpm check && pnpm test` are green, the **step-5a `code-review`
self-pass** ran and its agreed findings are fixed, and notes are recorded.
Hand to `md-review-pr` (reviewer), then `md-qa-review` — do NOT self-mark done. After review,
**every** thread is answered (accept/reject with why) **and** resolved before merge.
