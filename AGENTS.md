# AGENTS.md — guidance for coding agents in this repo

This is a **TanStack Start playground** (Cloudflare Workers target). The real
product idea lives in `stardust/` (gitignored). Treat `src/` as demo scaffolding
— currently the "Haute Pâtisserie 2026" sample content.

## TanStack introspection: use the CLI, not the old MCP server

`tanstack mcp` has been **removed from the CLI and will not be restored**. If you
have a stale MCP client config pointing at `@tanstack/cli mcp`, remove it. Call
the CLI directly with `--json` for deterministic parsing.

| Need | Command |
|---|---|
| List add-ons | `tanstack create --list-add-ons --framework React --json` |
| Add-on details | `tanstack create --addon-details <name> --framework React --json` |
| Scaffold an app | `tanstack create my-app --framework React --add-ons <a,b>` |
| List libraries | `tanstack libraries --json` |
| Read a doc | `tanstack doc query framework/react/overview --json` |
| Search docs | `tanstack search-docs "server functions" --library start --json` |
| Ecosystem | `tanstack ecosystem --category database --json` |

Recommended workflow: always pass `--json`, parse the structured output.

## This app's own MCP endpoint (connect an agent to the running site)

This repo hosts a minimal, read-only MCP server at `POST /api/mcp`
(see `src/routes/api.mcp.ts`). Connect Claude Code to the running dev server:

```sh
pnpm dev   # serves http://localhost:3000
claude mcp add --transport http stardust http://localhost:3000/api/mcp
```

Tools exposed: `search_site`, `list_speakers`, `list_talks`, `get_page_markdown`.

## Conventions

- Package manager: **pnpm**. Lint/format: **Biome** (`pnpm check`).
- Tests: **Vitest** (`pnpm test`). Test config is in `vitest.config.ts`, kept
  separate from `vite.config.ts` because the Cloudflare Workers plugin is
  incompatible with Vitest's SSR environment.
- Deploy: Cloudflare Workers via `pnpm deploy` (wrangler).
- Content: markdown in `content/` via `@content-collections`.
- LLMO: structured data/meta live in route `head()`s; helpers in `src/lib/`
  (`site-config.ts`, `structured-data.ts`, `seo.ts`, `site-content.ts`). See the
  README "AI & LLM" section.

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
→ `developer`/`md-implement` (TDD) → `qa`/`md-qa-review` (gate) → `devops`/`md-deploy`
(close issue). Full diagram + gates: `.claude/skills/references/sdlc-loop.md`.

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
| `qa` | a story is at `in-review` | `md-qa-review` | story QA verdict, bug issues |
| `devops` | QA signed off; deploy/wrangler/CI | `md-deploy` | deploy config/notes |

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
