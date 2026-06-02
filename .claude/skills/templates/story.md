---
id: <github-issue-number>        # source of truth for status; "draft" until issue exists
slug: <kebab-slug>
title: <imperative title>
status: todo                     # todo | in-progress | in-review | done | blocked
type: story                      # epic | story | bug | spike
priority: P2                     # P0 | P1 | P2 | P3
role: developer                  # primary subagent that owns implementation
epic: <parent-epic-issue#>       # optional
issue: <url>                     # filled in once the issue exists
links:                           # the context substrate — read these first
  prd: docs/product/<...>.md
  architecture: docs/architecture/adr/<...>.md
  design: docs/design/<...>.md
created: YYYY-MM-DD
---

## Goal
One paragraph: the outcome and why it matters.

## Context & links
Pointers to the PRD / ADR / design above and the key constraints
(TanStack Start, Cloudflare Workers, pnpm, Biome, Vitest).

## Acceptance criteria
- [ ] AC1 — testable
- [ ] AC2 — testable

## Out of scope
- …

## Implementation notes
<!-- developer appends: approach, files touched, decisions -->

## QA verdict
<!-- qa appends: commands run + output evidence, AC pass/fail, sign-off -->
