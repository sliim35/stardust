---
name: md-qa-review
description: Use to verify a story's acceptance criteria with evidence and review the diff before merge. Records a QA verdict and files bug issues. Used by the qa agent. Delegates to verification-before-completion and requesting-code-review.
---

# md-qa-review — SDLC QA phase

Gate the work: evidence before assertions.

## When to use
After the developer reports a story at `in-review`.

## Inputs (read first)
- The story `docs/stories/<id>-*.md` (especially the acceptance criteria).
- The diff: `git --no-pager diff` against the base.

## Procedure
1. **Verify with evidence** using the superpowers `verification-before-completion` skill:
   run `pnpm check`, `pnpm test`, and `pnpm build`; paste the actual output. Use the
   `playwright` MCP for UI acceptance checks where relevant — drive it against the PR's
   **preview-deploy URL** (the sticky comment from `preview.yml`), not just localhost.
   - **Visual evidence on the PR = that preview URL + a short list of the states you
     verified** (route, `prefers-reduced-motion`, etc.). Playwright screenshots stay
     local: **GitHub has no API to attach inline images** (drag-drop is browser-UI-only),
     so never paste a local file path — it renders broken. Fill the PR's *Screenshots /
     visual evidence* section with the preview URL + verified-states checklist (or
     "N/A — no visual change" for non-visual PRs).
   - **If you do save a Playwright screenshot locally, write it under `docs/qa/` — never the
     repo root** (see AGENTS.md § Conventions; `docs/` is gitignored, so it stays a local artifact).
2. **Check each AC** explicitly — tick the boxes that genuinely pass; for any that fail,
   say so with the failing output.
3. **Review the diff** for **correctness** using the superpowers `requesting-code-review`
   skill. (Conventions/style + the learning loop are the `reviewer` phase — `md-review-pr`
   runs before you; don't re-litigate them here.)
4. **Record** the verdict (commands + output + per-AC pass/fail) in the story's *QA verdict*
   section. For real defects, open a bug issue:
   `gh issue create --label "type:bug,role:dev" …`.
5. **Decide the gate**: sign off (→ `md-deploy`) or send back to `md-implement` with specifics.

## Output
A QA verdict with evidence; bug issues if needed; a clear pass/fail gate.

## Delegates to
`superpowers:verification-before-completion`, `superpowers:requesting-code-review`; `playwright` MCP.

## Done when
Every AC is evidenced as pass/fail and the merge/deploy gate decision is explicit.
