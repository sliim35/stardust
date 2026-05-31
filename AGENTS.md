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
