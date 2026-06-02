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

`orchestrator` routes → `researcher`/`md-research` → `architect`/`md-write-prd` +
`md-plan-architecture` → `ui-designer`/`md-design-ui` (if visual) →
`task-creator`/`md-create-story` (+ GitHub issue) → `backlog-analyzer`/`md-groom-backlog`
→ `developer`/`md-implement` (TDD) → `reviewer`/`md-review-pr` (conventions + learning) →
`qa`/`md-qa-review` (gate) → `devops`/`md-deploy` (close issue) →
`orchestrator`/`md-learn` (retro: distill the session → route to docs/memory/skills).
Full diagram + gates: `.claude/skills/references/sdlc-loop.md`.

### The docs/ contract — read before you act, write after you decide

`docs/` is the local context substrate (it is **gitignored**); **GitHub Issues are the
durable, shareable record**. Before acting, read the story and the artifacts in its
`links:` (PRD, ADR, design). After deciding, write your artifact to the right `docs/`
folder (templates in `.claude/skills/templates/`), append a line to
`docs/decisions/decision-log.md`, and sync the issue. Because `docs/` isn't committed,
issue bodies must duplicate goal + acceptance criteria. See
`.claude/skills/references/docs-contract.md` and `docs/README.md`.

### Agent roster — when to invoke

| Agent | Invoke when… | Primary skill | Owns in docs/ |
|---|---|---|---|
| `orchestrator` | starting work / unsure what's next | — (routes) | — |
| `researcher` | there's an unknown to de-risk | `md-research` | `research/` |
| `architect` | design/stack/ADR decisions, or a PRD | `md-plan-architecture`, `md-write-prd` | `architecture/`, `product/` |
| `ui-designer` | a visual feature needs a spec | `md-design-ui` | `design/` |
| `task-creator` | slicing scope into stories+issues | `md-create-story` | `stories/` |
| `backlog-analyzer` | grooming / "what's next?" | `md-groom-backlog` | story status, issues |
| `developer` | a prioritized story is ready to build | `md-implement` | `src/`, story notes |
| `reviewer` | a PR is open at `in-review` (before QA) | `md-review-pr` | `conventions/code-style.md`, story Code-review |
| `qa` | a story is at `in-review` | `md-qa-review` | story QA verdict, bug issues |
| `devops` | QA signed off; deploy/wrangler/CI | `md-deploy` | deploy config/notes |
| `orchestrator` | a story merged — run the retro | `md-learn` | `decisions/`, `memory` |

### Backlog conventions (GitHub Issues)

- **`gh` is the interface.** Issue number = story id; story file `<issue#>-<slug>.md`.
- **Labels:** `type:{epic,story,bug,spike}` · `priority:{P0..P3}` ·
  `status:{todo,in-progress,in-review,blocked}` (done = closed) ·
  `role:{research,architecture,design,dev,qa,devops}`. Defined in `.github/labels.yml`.
- **Templates:** `.github/ISSUE_TEMPLATE/` (epic, story, bug, research-spike).
- **Remote:** `github.com/sliim35/stardust` (origin, public). Labels + the Memory Galaxy epic
  (#1) and initial stories (#2–#5) are already seeded. `scripts/sdlc/seed-backlog.sh` is
  idempotent for labels and self-guards against re-creating the epic, so it is safe to re-run.
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
