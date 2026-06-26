---
name: md-qa-review
description: Use to verify a story's acceptance criteria with evidence and review the diff before merge. Records a QA verdict and files bug issues. Used by the qa agent. Delegates to verification-before-completion and requesting-code-review.
---

# md-qa-review — SDLC QA phase

Gate the work: evidence before assertions.

## When to use
After the developer reports a story at `in-review`.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- The story `docs/stories/<id>-*.md` (especially the acceptance criteria).
- The diff: `git --no-pager diff` against the base.

## Staging the target branch (who runs the gate) — #99
The `qa` agent's allowlist (`.claude/agents/qa.md`) intentionally **omits**
`git fetch`/`checkout`/`switch`/`worktree`, so qa **cannot self-stage** a PR branch under
`isolation: "worktree"`: the fresh worktree is forked from the parent HEAD, qa can't switch it
onto the target branch, and its `pnpm` tools only match its own cwd (so it can't `cd` into a
separately-staged path either). The phase therefore **splits**:
- **Orchestrator stages + runs the gate.** It checks out the target branch (typically a detached
  `origin/<branch>` worktree) and runs `pnpm check && pnpm test && pnpm build`, capturing the
  output to hand to qa.
- **qa adjudicates.** It reads the story ACs and the diff (`git --no-pager diff`), checks each AC
  against that gate output, runs any UI/`playwright` acceptance checks it can, and records the
  verdict. **qa still owns the pass/fail gate** — it must *see* green `check`/`test`/`build`
  output, never take it on faith.

When qa can already run the gate in its own cwd (e.g. dispatched in-place on an
already-checked-out branch), it runs `pnpm check/test/build` directly per step 1 — the split only
applies when qa would otherwise need to switch branches.

## Procedure
1. **Verify with evidence** using the superpowers `verification-before-completion` skill:
   run `pnpm check`, `pnpm test`, and `pnpm build`; paste the actual output. Use the
   `playwright` MCP for UI acceptance checks where relevant — drive it against the PR's
   **preview-deploy URL** (the sticky comment from `preview.yml`). **Use the preview URL,
   not localhost.** localhost (`pnpm dev`) is a last-resort fallback ONLY when the preview
   URL is genuinely unavailable — and that unavailability is itself a blocker to flag (the
   preview deploy is broken — e.g. the missing-Preview-URL bug #118), not something to paper
   over with a silent localhost run. If you do fall back, say so explicitly in the verdict.
   - **Attach the actual screenshots to the PR for every visual change — not optional.** The
     owner reviews visually and has repeatedly flagged missing screenshots; an empty
     Screenshots section reads as "skipped". Primary evidence = the live **preview URL + the
     states you verified** (route, `prefers-reduced-motion`, etc.) — AND embed the captured
     frames inline. Drag-drop upload is browser-UI-only, but you CAN attach images: commit the
     PNGs to a throwaway branch via the git-database API (blobs → tree → orphan commit → ref)
     and embed their `raw.githubusercontent.com` URLs in a PR comment (proven on #115; repo is
     public; verify each URL returns `200 image/png` first). Curate honestly — only frames you
     actually captured and viewed; if a required state couldn't be captured, say so rather than
     relabel another shot.
   - **Save local Playwright screenshots under `docs/qa/` — never the repo root** (see
     AGENTS.md § Conventions; `docs/` is gitignored, so it stays a local artifact).
2. **Check each AC** explicitly — tick the boxes that genuinely pass; for any that fail,
   say so with the failing output.
   - **Verify the rendered result against the intended shape *and its underlying data*,
     not the math or "a shape is visible."** For a figure/overlay, confirm the relationship
     holds — e.g. do the member stars actually sit *on* the figure that connects them? —
     by comparing the render to the reference, never a label or a geometry proof
     (`memory: galaxy-visual-qa-by-shape`).
   - **Never rationalize an observed anomaly into a pass.** If you notice something off (a
     faint/partial/offset/"below the stars" render) and cannot cite the spec/AC rule that
     makes it *correct*, it is a **finding**, not "expected forming". A QA verdict that
     literally noted "center below the stars" and called it expected is how the Joy figure
     shipped detached from its stars (#232 retro). When in doubt, surface it to the owner.
3. **Review the diff** for **correctness** using the superpowers `requesting-code-review`
   skill. (Conventions/style + the learning loop are the `reviewer` phase — `md-review-pr`
   runs before you; don't re-litigate them here.)
4. **Record** the verdict (commands + output + per-AC pass/fail) in the story's *QA verdict*
   section. For real defects, open a bug issue:
   `gh issue create --label "type:bug,role:dev" …`.
5. **Decide the gate**: sign off (→ `md-deploy`) or send back to `md-implement` with specifics.
6. **Tear down — REQUIRED (QA is not finished until this runs, on pass OR fail).** Clean up
   every environment staged for this QA: kill all dev/preview servers started for it
   (`pnpm dev` / `vite dev` / `wrangler`), free their ports — including the Node inspector
   **`9229`** (only one `vite dev` can hold it, so a lingering server blocks the next QA) and any
   app ports (`3000`, `3254`, `3255`, …) — and prune stale QA worktrees. Use a **per-PID loop**
   (zsh won't split `$PIDS`): `for pid in $(lsof -ti tcp:<port>); do kill "$pid"; done`. Leave no
   orphaned process or bound port. If the **`md-workflow` mediator** (not you) staged the server — see
   "Staging the target branch" — state in the verdict that teardown is owed so it isn't left
   running (`memory: post-qa-cleanup-phase`).

## Output
A QA verdict with evidence; bug issues if needed; a clear pass/fail gate.

## Delegates to
`superpowers:verification-before-completion`, `superpowers:requesting-code-review`; `playwright` MCP.

## Done when
Every AC is evidenced as pass/fail, the merge/deploy gate decision is explicit, **and the QA
environment is torn down** — all dev/preview servers killed, their ports (incl. `9229`) freed, and
stale QA worktrees pruned (step 6). A passing verdict with a server still bound to `9229`/`3xxx` is
**not done**.
