# CLAUDE.md

This is a TanStack Start playground. **For agent guidance, tooling, and the
self-hosted MCP endpoint, read [AGENTS.md](./AGENTS.md).**

Quick commands: `pnpm dev` · `pnpm test` · `pnpm check` · `pnpm build`.

The real product idea (a pixel-art "Memory Galaxy") is a Claude Design handoff
bundle in `stardust/` (gitignored); `src/` is demo scaffolding for now.

## AI SDLC

This repo runs a lightweight multi-agent SDLC (AAMAD/BMAD-style). Roles live in
`.claude/agents/`, phase procedures in `.claude/skills/md-*`, the shared knowledge
base in `docs/` (gitignored, local), and the backlog in **GitHub Issues**. Default
entry point: the **`orchestrator`** agent. **Before non-trivial work, read
[AGENTS.md](./AGENTS.md) § "AI SDLC" and `docs/README.md`** — read the relevant
`docs/` artifacts before acting, write your artifact after you decide.
