---
name: md-review-pr
description: Use to review a pull request — verify it conforms to the pinned spec/ADR contracts, enforce the living code-style guide + best practices, and learn from inline review comments (the human's on this PR + mined history) back into the guide. Runs before QA. Used by the reviewer agent. Delegates the diff review to code-review.
---

# md-review-pr — SDLC code-review phase

Review the PR on two axes — **spec/ADR conformance** (does the diff match the pinned
contracts in the story's linked spec + ADR?) and **conventions/style/best-practices** —
and get smarter each run by learning from the inline comments left on PRs. Runs at
`in-review`, after `developer` opens the PR and **before** `md-qa-review`.

## When to use
A story is at `status:in-review` with an open PR. This phase owns **spec/ADR conformance**
(the diff vs. the pinned contracts) + conventions/style + the learning loop. Spec/ADR
conformance is a *static contract* check against what's written — distinct from QA's gate,
which verifies the acceptance criteria actually pass with evidence.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- The PR diff + metadata: `gh pr diff <pr>` and `gh pr view <pr> --json title,body,files`.
- **The human's inline review comments are NOT in `gh pr view`.** `--json comments`
  returns only issue-timeline comments, and `reviews[].body` is empty when the human
  left just a line comment (the text lives in that review's `comments[]`, which
  `gh pr view` never expands) — so diff-anchored feedback is invisible to both. Always
  read it via the GraphQL `reviewThreads` query in step 4.
- The living guide `docs/conventions/code-style.md`. **Bootstrap it from
  `.claude/skills/templates/code-style.md` if it doesn't exist yet** (seed the
  hand-written section from `AGENTS.md` § Conventions).
- **The story `docs/stories/<id>-*.md` and the artifacts in its `links:`** — the PRD,
  the **ADR(s)** (`architecture:`), and the **design spec** (`design:`). These pin the
  *contracts* you check the diff against: exact signatures, regexes, invariants, data
  shapes, named constants, error messages. Also skim recent ADRs + the decision log for
  anything the diff touches.

## Procedure
1. **Load conventions + contracts.** Read `docs/conventions/code-style.md` (+ `AGENTS.md`
   § Conventions) — those rules are what you enforce. Then **follow the story's `links:`**
   to the spec + ADR(s) and list the **pinned contracts** the diff must honour: exact
   signatures, regexes, invariants, data shapes, named constants, error messages.
2. **Check spec/ADR conformance** (a standing, explicit charge — *not* owner-prompted).
   Walk the diff against each pinned contract from step 1 and confirm it is implemented
   **as written**: signatures/types match, regexes are byte-identical, invariants hold,
   nothing the spec mandates is silently dropped and nothing material is added beyond it.
   Report these findings **separately from style nits** — as their own *Spec/ADR
   conformance* section, each citing the contract it's checked against (`spec §…` /
   `ADR-NNNN`) with a `match | deviation | gap | undocumented-extra` verdict. **If the
   story has no spec/ADR link**, say so in one line and move on — don't invent contracts.
   This is a *contract* check (diff vs. the written spec), not an *AC* check — QA owns
   "does it actually pass."
3. **Review the PR** (style/conventions). Delegate generic correctness / reuse /
   simplification to the built-in **`code-review`** skill (or
   `superpowers:requesting-code-review`). Then layer on guide-rule + best-practice
   enforcement. Every finding carries `file:line`, a severity
   (`blocker | major | minor | nit`), and the **rule it cites**.
4. **Learn from inline comments** (the feedback edge):
   - **This PR first — highest priority.** Read the inline review *threads* on *this* PR
     via GraphQL, so you get `isOutdated`/`isResolved` (the REST `…/pulls/<pr>/comments`
     endpoint lacks both and re-learns dead anchors):
     ```
     gh api graphql -f query='
       query($owner:String!,$repo:String!,$pr:Int!){ repository(owner:$owner,name:$repo){
         pullRequest(number:$pr){ reviewThreads(first:100){ nodes{
           isResolved isOutdated
           comments(first:50){ nodes{ author{login} path line body createdAt }}
         }}}}}' -F owner={owner} -F repo={repo} -F pr=<pr>
     ```
     **Drop `isOutdated` threads** (the anchored code no longer exists). **Keep
     `isResolved` ones** — "use X not Y" is still a convention even after the dev fixed
     it this time. Human comments (`author.login` ≠ the review bot) are direct
     corrections — treat them as authoritative.
   - **Then mine history.** Inline comments newer than the guide's `last_learned`
     watermark across recent merged/closed PRs:
     `gh api repos/{owner}/{repo}/pulls/comments --paginate`.
   - **Distill.** Drop praise / questions / `isOutdated` (dead-anchor) comments; keep
     actionable corrections (`isResolved` ones included). Cluster by theme; a theme
     stated normatively or seen ≥2× becomes a rule (statement · rationale · example ·
     source PR links).
   - **Auto-append** distilled rules under `## Learned conventions`, deduped against
     existing rules. If a signal **contradicts a hand-written rule**, put it under
     `## Conflicts to resolve (human)` — never overwrite. Advance `last_learned` and
     bump `updated`.
5. **Output.** **Default — post to the PR under the review bot's identity** so findings are
   attributable to the reviewer (`reviewer-stardust-project[bot]`), not the human:
   - **Get the bot token** via the cached helper **`scripts/sdlc/bot-token.sh`** — it returns a
     valid installation token and only **re-mints** (via `gh-token` + the App key from **1Password
     at mint-time**, never a resident file) when the cached one nears expiry, so the `op` approval
     is **~hourly, not per-review** (ADR-0005 / F2; #100):
     `BOT_TOKEN="$(scripts/sdlc/bot-token.sh)"`.
     **Graceful fallback:** if it fails (no `op` session / extension absent / empty token), drop
     `GH_TOKEN` and post with the default `gh` auth (as the human) — never block the review on the
     bot. Setup + the inline (uncached) one-liner: `scripts/sdlc/README.md`.
   - **Post** one `COMMENT` review: `GH_TOKEN="$BOT_TOKEN" gh api
     repos/{owner}/{repo}/pulls/<pr>/reviews` with a `comments[]` array — a summary
     (leading with the *Spec/ADR conformance* verdict, kept separate from the style
     findings) + per-finding inline comments anchored to `file:line` (severity · cited
     rule-or-contract · suggested fix). The bot
     isn't the PR author, so `REQUEST_CHANGES` is available too; still default to `COMMENT`
     (don't gate merges — that's QA).
   Always also emit the markdown verdict in chat. Pass **`--no-comment`** to skip the GitHub
   write (dry run, or a PR you don't own). Bot setup: `scripts/sdlc/README.md`.
6. **Record.** Write the spec/ADR-conformance verdict + the style verdict + any new
   learned rules into the story's *Code review* section; append a line to
   `docs/decisions/decision-log.md`; sync the issue (label/comment).

## Output
A **Spec/ADR conformance** verdict (diff vs. the pinned contracts, reported *separately*
from style) **plus** style/convention findings — as inline PR comments + a summary review
**posted to the PR by default** as `reviewer-stardust-project[bot]` (`--no-comment` to skip;
falls back to your `gh` auth if the App key isn't available); a markdown verdict in chat
(findings cited against contracts + rules); an updated `docs/conventions/code-style.md`.

## Delegates to
`code-review` (built-in) / `superpowers:requesting-code-review`; `gh` CLI.

## Done when
Spec/ADR conformance was checked against the story's linked contracts (or their absence
noted) and reported separately from style nits, findings are cited against contracts +
rules, the learning step ran (this PR's comments read, watermark advanced), the verdict is
recorded, and posted to the PR (unless `--no-comment`). Hand to `md-qa-review`. Spec/ADR
conformance + conventions/style is your job; AC verification is QA's.
