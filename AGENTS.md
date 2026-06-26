# AGENTS.md — guidance for coding agents in this repo

This is a **TanStack Start playground** (Cloudflare Workers target). The real
product idea lives in `stardust/` (gitignored). As of the clean-slate first commit
(**ADR-0003**), `src/` is the **Memory Galaxy shell** — a root `/` route + a `Layout`
(`src/components/Layout.tsx`) rendering a deterministic, seeded pixel-art starfield
backdrop (`src/lib/starfield.ts`). The earlier "Haute Pâtisserie 2026" demo was deleted
wholesale; recover any pattern from git history (e.g. `git show cb17529:src/lib/seo.ts`).

## TanStack introspection: use the CLI, not the old MCP server

`tanstack mcp` has been **removed from the CLI and will not be restored**. If you
have a stale MCP client config pointing at `@tanstack/cli mcp`, remove it. Call
the CLI directly with `--json` for deterministic parsing.

**The CLI is not installed in this repo — run it on demand via `pnpm dlx tanstack …`**
(equivalently `pnx tanstack` / `npx tanstack`). The binary is `tanstack`.

| Need | Command (prefix with `pnpm dlx`) |
|---|---|
| List add-ons | `tanstack create --list-add-ons --framework React --json` |
| Add-on details | `tanstack create --addon-details <name> --framework React --json` |
| Scaffold an app | `tanstack create my-app --framework React --add-ons <a,b>` |
| List libraries | `tanstack libraries --json` |
| Read a doc | `tanstack doc <library> <path> --json` (e.g. `tanstack doc react-start framework/react/overview --json`) |
| Search docs | `tanstack search-docs "server functions" --library start --json` |
| Ecosystem | `tanstack ecosystem --category database --json` |

Recommended workflow: always pass `--json`, parse the structured output. Full reference:
<https://tanstack.com/cli/latest/docs/cli-reference>. (The doc subcommand is
`tanstack doc <library> <path>` — *not* `tanstack doc query …`.)

## This app's own MCP endpoint (retired — ADR-0003)

The demo hosted a read-only MCP server at `POST /api/mcp` (conference tools:
`search_site`, `list_speakers`, …). It was **deleted in the clean-slate commit** along
with the rest of the demo. The *pattern* (a zero-dependency Streamable-HTTP MCP route,
Workers-friendly and stateless) is documented in `docs/tanstack-ai.md` and recoverable from
git history — reintroduce it for the galaxy only when an agent needs to read the live sky.

## Conventions

- Package manager: **pnpm**. Lint/format: **Biome** (`pnpm check`).
- Tests: **Vitest** (`pnpm test`). Test config is in `vitest.config.ts`, kept
  separate from `vite.config.ts` because the Cloudflare Workers plugin is
  incompatible with Vitest's SSR environment.
- Deploy: Cloudflare Workers via `pnpm deploy` (wrangler).
- Content: markdown in `content/` via `@content-collections`.
- **Image artifacts — never at the repo root.** Preview/variant screenshots go under
  `docs/img/preview/`; QA visual captures under `docs/qa/`. (Both live below the gitignored
  `docs/`, so they stay local artifacts.) Repo-shipped assets — favicons, OG images — belong
  in `src/`/`public/`, not here. Saving any `.png`/`.jpg` to the project root is wrong.
- **Styling boundary (#75):** Tailwind utilities for DOM chrome; `src/styles.css`
  (+ `src/lib/galaxy/palette.ts`) for the canvas stage. Color/space/radius tokens live
  once in the `@theme` block in `styles.css` — never hardcode a hex in a chrome component.
- **i18n — all user-facing text lives in the catalog (ADR-0007, #103):** Every string a
  user can see or a screen reader announces — visible copy, `aria-label`, `alt`,
  `<title>`/`meta`, button/sr-only labels — **MUST** be added to the typed i18n catalog
  (`src/lib/i18n/messages/{en,ru}.ts`, shaped by `Messages` in `src/lib/i18n/types.ts`) and
  read in components via `getMessages(useLocale())`. **Never hardcode a user-facing string
  inline** in a component or route. Fill **both** locales (`en` is the source, `ru` the
  translation); ru parity is compile-enforced by `as const satisfies Messages`. Use
  `interpolate(...)` for `{token}` placeholders; keep the rotation/active-locale rules pure
  functions of the URL (no `Accept-Language`/cookie/`Date`/random → no hydration mismatch).
  Non-user-facing strings (class names, `data-*`, test fixtures, dev logs) are exempt.
- LLMO: the conference LLMO helpers (`seo.ts`, `structured-data.ts`, …) were retired in
  the clean-slate commit (ADR-0003). The patterns + a re-apply checklist live in
  `docs/tanstack-ai.md`; reintroduce `head()` structured data once the galaxy has crawlable
  content.
- **Code style:** the living conventions guide is `docs/conventions/code-style.md`
  (gitignored — enforced + grown by the `reviewer` phase, `md-review-pr`). Core rules:
  **DRY / KISS / YAGNI**; **arrow functions** over `function` declarations; **`type`
  aliases over `interface`**; **`as const`** for constant literal data; **composition
  over inheritance**; a **functional paradigm**
  ([Functional-Light-JS](https://github.com/getify/Functional-Light-JS)). The arrow-function
  rule is enforced by Biome — `useArrowFunction` (expressions) + the GritQL plugin
  `biome-plugins/use-arrow-functions.grit` (declarations).

## AI SDLC

A lightweight multi-agent software-development lifecycle (grounded in the **AAMAD** and
**BMAD** frameworks) built on Claude Code primitives: **subagents = roles**, **`md-*`
skills = phase procedures**, **`docs/` = shared knowledge base**, **GitHub Issues =
backlog**. It composes with the installed *superpowers* skills (TDD, brainstorming,
writing-plans, verification, code-review, worktrees) rather than re-implementing them.

### The loop

The **`/md-workflow`** mediator skill routes + drives → `researcher`/`md-research` → `architect`/`md-write-prd` +
`md-plan-architecture` → `ui-designer`/`md-design-ui` (if visual) →
`task-creator`/`md-create-story` (+ GitHub issue) → `backlog-analyzer`/`md-groom-backlog`
→ `developer`/`md-implement` (TDD) → `reviewer`/`md-review-pr` (conventions + learning) →
`qa`/`md-qa-review` (gate) → `devops`/`md-deploy` (close issue) →
`/md-workflow`/`md-learn` (retro: distill the session → route to docs/memory/skills).
Full diagram + gates: `.claude/skills/references/sdlc-loop.md`.

**CI auto-reviewer (additive — not a phase).** `.github/workflows/claude-review.yml` runs
`anthropics/claude-code-action` on every PR (on the owner's Claude subscription) for a fast
automatic first pass that *echoes* the `reviewer`/`md-review-pr` conventions. It does **not**
replace the `reviewer` phase — that agent still owns spec/ADR conformance and grows
`conventions/code-style.md`. Gotcha: claude-code-action only activates **after** a workflow
change merges to `main` (security guard), so a PR that edits `claude-review.yml` shows a green
`review` check that *skipped* the actual review. (#195/#203)

### The docs/ contract — read before you act, write after you decide

`docs/` is the local context substrate (it is **gitignored**); **GitHub Issues are the
durable, shareable record**. Before acting, read the story and the artifacts in its
`links:` (PRD, ADR, design). After deciding, write your artifact to the right `docs/`
folder (templates in `.claude/skills/templates/`), append a line to
`docs/decisions/decision-log.md`, and sync the issue. Because `docs/` isn't committed,
issue bodies must duplicate goal + acceptance criteria. See
`.claude/skills/references/docs-contract.md` and `docs/README.md`.

### Traceability is the #1 priority — work on the PR + the issue + `docs/`, never only in chat

**(Owner rule, emphatic — this outranks every other convention in this file.)** This is a
**fully autonomous SDLC**: the loop runs agent-to-agent and the owner reviews
**asynchronously, after the fact**, so **GitHub (PRs + issues) plus `docs/` is the only
observable, durable record of what happened**. Anything that lives only in chat — or only in
an agent's head — is invisible to the owner and to the next agent in the loop, and is therefore
**lost**. So every load-bearing action and decision MUST leave a durable trail across the
**PR, the issue, and `docs/`**. When traceability competes with speed, **traceability wins** —
an undocumented result is treated as not done.

- **Run the whole review/QA loop on the PR, visibly:** open the PR, post the review as a real
  PR review (inline, batched), push fixes as commits, reply accept/reject-with-why on **every**
  thread before resolving, and QA on the **preview URL with screenshots attached** (commit
  PNGs to a `qa-shots-*` branch + embed raw URLs — there is no image-upload API).
- **Record DECISIONS on the story issue AND `docs/decisions/decision-log.md`, with
  screenshots.** A design pick — including one made in chat (e.g. an owner choice) — gets a
  comment on the **issue** stating the decision, the alternatives rejected, links to the
  PR/commits/preview, and the evidence images. Not just the PR; not just chat.
- **Subagents do NOT inherit the mediator's memory.** The dispatcher MUST state this
  traceability requirement in every task prompt, and the subagent MUST honor it — return
  findings/decisions in a form the mediator can post to the issue/PR, and never treat a
  chat-only summary as "done."

All agent GitHub writes route through the review bot (ADR-0005).

### Agent roster — when to invoke

| Agent | Invoke when… | Primary skill | Owns in docs/ |
|---|---|---|---|
| `/md-workflow` (mediator skill) | starting work / driving any task(s) end-to-end; post-merge → run the retro | routes + drives · `md-learn` | `memory`, `decisions/` |
| `researcher` | there's an unknown to de-risk | `md-research` | `research/` |
| `architect` | design/stack/ADR decisions, or a PRD | `md-plan-architecture`, `md-write-prd` | `architecture/`, `product/` |
| `ui-designer` | a visual feature needs a spec | `md-design-ui` | `design/` |
| `task-creator` | slicing scope into stories+issues | `md-create-story` | `stories/` |
| `backlog-analyzer` | grooming / "what's next?" | `md-groom-backlog` | story status, issues |
| `developer` | a prioritized story is ready to build | `md-implement` | `src/`, story notes |
| `reviewer` | a PR is open at `in-review` (before QA) | `md-review-pr` | `conventions/code-style.md`, story Code-review |
| `qa` | a story is at `in-review` | `md-qa-review` | story QA verdict, bug issues |
| `devops` | QA signed off; deploy/wrangler/CI | `md-deploy` | deploy config/notes |

> `/md-workflow` is a **skill the main session runs**, not a dispatchable agent — it both keeps
> cross-phase context and dispatches the phase agents listed above. It is the **default entry
> point** for any unit of work and accepts one **or more** tasks at once.

### Backlog conventions (GitHub Issues)

- **`gh` is the interface.** Issue number = story id; story file `<issue#>-<slug>.md`.
- **Branches:** `<type>/<issue#>-<short-description>` — the conventional-commit type, the
  story's issue number, then a kebab slug (e.g. `chore/99-qa-stage-split`,
  `feat/71-astro-interactive-states`, `fix/86-starfield-hydration`). Branch off `main`.
- **Stacked PRs:** GitHub only retargets a child PR to `main` when its base **branch is
  deleted** on merge — merging a child into an already-merged-but-undeleted base strands
  the content off `main` silently (#178 → re-land #179). When stacking: state the required
  merge order in **both** PR bodies, and after the base merges, retarget the child to
  `main` before it is merged.
- **Labels:** `type:{epic,story,bug,spike}` · `priority:{P0..P3}` ·
  `status:{todo,in-progress,in-review,blocked}` (done = closed) ·
  `role:{research,architecture,design,dev,qa,devops}`. Defined in `.github/labels.yml`.
- **Templates:** `.github/ISSUE_TEMPLATE/` (epic, story, bug, research-spike).
- **Remote:** `github.com/sliim35/stardust` (origin, public). Labels + the Memory Galaxy epic
  (#1) and initial stories (#2–#5) are already seeded. `scripts/sdlc/seed-backlog.sh` is
  idempotent for labels and self-guards against re-creating the epic, so it is safe to re-run.
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
