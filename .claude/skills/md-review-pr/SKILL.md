---
name: md-review-pr
description: Use to review a pull request against the living code-style guide, enforce best practices, and learn from inline review comments (the human's on this PR + mined history) back into the guide. Runs before QA. Used by the reviewer agent. Delegates the diff review to code-review.
---

# md-review-pr — SDLC code-review phase

Review the PR for conventions, style, and best practices — and get smarter each run
by learning from the inline comments left on PRs. Runs at `in-review`, after
`developer` opens the PR and **before** `md-qa-review`.

## When to use
A story is at `status:in-review` with an open PR. This phase owns conventions/style +
the learning loop; correctness/AC verification is QA's gate, not this one.

## Inputs (read first)
- The PR: `gh pr diff <pr>` and `gh pr view <pr> --json title,body,files,reviews,comments`.
- The living guide `docs/conventions/code-style.md`. **Bootstrap it from
  `.claude/skills/templates/code-style.md` if it doesn't exist yet** (seed the
  hand-written section from `AGENTS.md` § Conventions).
- The story `docs/stories/<id>-*.md` (intent/AC), recent ADRs, the decision log.

## Procedure
1. **Load conventions.** Read `docs/conventions/code-style.md` (+ `AGENTS.md` §
   Conventions). Those rules are what you enforce.
2. **Review the PR.** Delegate generic correctness / reuse / simplification to the
   built-in **`code-review`** skill (or `superpowers:requesting-code-review`). Then
   layer on guide-rule + best-practice enforcement. Every finding carries `file:line`,
   a severity (`blocker | major | minor | nit`), and the **rule it cites**.
3. **Learn from inline comments** (the feedback edge):
   - **This PR first — highest priority.** Read the inline comments left on *this* PR,
     especially the human's: `gh api repos/{owner}/{repo}/pulls/<pr>/comments`. These
     are direct corrections — treat them as authoritative.
   - **Then mine history.** Inline comments newer than the guide's `last_learned`
     watermark across recent merged/closed PRs:
     `gh api repos/{owner}/{repo}/pulls/comments --paginate`.
   - **Distill.** Drop praise / questions / outdated / deleted-code comments; keep
     actionable corrections. Cluster by theme; a theme stated normatively or seen ≥2×
     becomes a rule (statement · rationale · example · source PR links).
   - **Auto-append** distilled rules under `## Learned conventions`, deduped against
     existing rules. If a signal **contradicts a hand-written rule**, put it under
     `## Conflicts to resolve (human)` — never overwrite. Advance `last_learned` and
     bump `updated`.
4. **Output.** **Default — post to the PR:** inline comments anchored to each finding's
   `file:line` (severity · cited rule · suggested fix) + a summary review, as a single
   `COMMENT` review (`gh api repos/{owner}/{repo}/pulls/<pr>/reviews` with a `comments[]`
   array — own-PRs can't `APPROVE`/`REQUEST_CHANGES`, so use `event: COMMENT`). Always also
   emit the markdown verdict in chat. Pass **`--no-comment`** to skip writing to GitHub
   (dry run, or a PR you don't own).
5. **Record.** Write the verdict + any new learned rules into the story's *Code review*
   section; append a line to `docs/decisions/decision-log.md`; sync the issue (label/comment).

## Output
Inline PR comments + a summary review **posted to the PR by default** (`--no-comment` to
skip); a markdown code-review verdict (findings cited against rules); an updated
`docs/conventions/code-style.md`.

## Delegates to
`code-review` (built-in) / `superpowers:requesting-code-review`; `gh` CLI.

## Done when
Findings are cited against rules, the learning step ran (this PR's comments read,
watermark advanced), the verdict is recorded, and posted to the PR (unless `--no-comment`).
Hand to `md-qa-review`. Conventions/style is your job, not QA's.
