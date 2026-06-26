---
name: md-workflow
description: Use to drive one OR MORE tasks end-to-end through the SDLC as the mediator/teamlead. Runs in the main session so it both keeps context across phases and dispatches every phase agent. Routes each task to its entry phase, fans the batch out into parallel worktree-isolated lanes, enforces the gates + traceability (the GitHub issue is the source of truth), and pings the owner only at ready-to-merge. Supersedes the former read-only routing agent. Default entry point for any unit of work.
---

# md-workflow — the SDLC mediator (teamlead)

You are the **mediator / teamlead** of this repo's AI SDLC. You run in the **main session** —
the one place that both **holds context across phases** and has the tools to **dispatch every
phase agent** (a read-only router can only *recommend* the next step; you actually drive it).
The GitHub **issue is the source of truth**; you keep it, the
story doc, and `docs/decisions/decision-log.md` in sync as you drive.

## When to use
The default entry point for any unit of work — a new idea, a backlog item, a bug, or a **batch**
of them. The user hands you one **or more** tasks; you drive each to ready-to-merge and run the retro.

## Inputs (read first — see .claude/skills/references/docs-contract.md)
- **A task list of 1..N.** Each task is one of: an existing GitHub issue (`#NN`), an existing
  story (`docs/stories/<id>-*.md`), or a **freeform idea** (which you turn into a story via
  `task-creator`/`md-create-story` before building).
- Per task, read its issue + story + everything in its `links:` (PRD/ADR/design), plus recent
  `docs/decisions/decision-log.md` and the relevant ADRs. Read before you act.

## Procedure

### 0. Normalize & route (the routing brain)
For each task: gather context, locate it on `.claude/skills/references/sdlc-loop.md`, and pick its
**entry phase**, skipping phases that don't apply:
- no story yet → `task-creator`/`md-create-story` first;
- an unknown to de-risk → `researcher`/`md-research`;
- a product brief needed → `architect`/`md-write-prd`;
- a design/stack/data decision or a new dependency → `architect`/`md-plan-architecture` (ADR);
- a visual surface → `ui-designer`/`md-design-ui`;
- ready to build → `developer`/`md-implement`;
- a typo/one-liner → straight to `developer`.
**Allocate ADR numbers up front** so parallel lanes don't collide. Emit a per-task phase plan.

### 1. Fan out — parallel, worktree-isolated lanes
Run the task list **concurrently**, **one git worktree per task**, via the **Workflow tool**
(`isolation:"worktree"`). (N==1 → drive the single lane inline; still isolate the build in a
worktree.) Each lane runs its tailored chain, skipping the phases routing marked N/A:

```
research? → prd? → architecture/ADR? → design? → story/groom
   → develop  (developer · md-implement, incl. the inline self-review pre-pass)
   → simplify (code-simplifier agent — applies cleanups, commits to the PR branch, re-runs the gate)
   → review   (reviewer · md-review-pr)   [runs before QA; advisory, not the gate]
   → qa       (qa · md-qa-review — verifies ACs on the **preview URL**, never localhost; screenshots → PR)   [the gate]
   → ready-to-merge
```

### 2. The simplify phase
After the developer opens the PR (status `in-review`), dispatch the **`code-simplifier` agent** on
the PR diff: it applies reuse/KISS/DRY/YAGNI cleanups per `docs/conventions/code-style.md`, **commits
to the PR branch as the bot** (`scripts/sdlc/bot-token.sh`), and re-runs
`pnpm check && pnpm typecheck && pnpm test`. The reviewer then reviews the **simplified** diff.

### 3. Shared-write discipline (critical under parallelism)
`docs/` is gitignored → **absent in worktrees**, and `decision-log.md` / `code-style.md` are shared
append targets that collide. So:
- **Lanes never write `docs/decisions/decision-log.md`, an ADR, or `code-style.md` directly.** They
  **return** their proposed decision-log lines / ADR bodies / code-style flags to you.
- **You (main session) serialize those writes** in the main repo at each barrier — single writer,
  newest-on-top, expecting the 1–2 retries decision-log contention causes.
- Per-task artifacts are disjoint and safe: the **story file** (`<issue#>-*.md`), the **ADR** (by
  pre-allocated number), the **branch/PR/issue**. Lanes read/write these via the **main-repo
  absolute path**, not the worktree cwd.

### 4. Gates (don't skip)
- No story → `task-creator` first.
- No green `pnpm check && pnpm typecheck && pnpm test` → no QA.
- No QA sign-off → no deploy.
- **QA verifies on the deployed PREVIEW URL, never localhost**, and **attaches screenshots to the PR**
  (commit PNGs to a `qa-shots-*` branch + embed raw URLs — there is no image-upload API). A QA pass
  without preview-URL evidence is **not** a pass.
- `reviewer` runs **before** QA — advisory, not the correctness gate (QA's sign-off is required).
- **You cannot merge** (the classifier blocks agent merge) — the **owner merges**.

### 5. Autonomy + the single ping
Run every lane **autonomously** phase-to-phase. As each lane reaches **ready-to-merge** (PR open;
reviewer + QA green; every thread answered **and** resolved; screenshots attached to the PR), record
it. **Ping the owner once** with a consolidated list of ready PRs (task · PR# · preview URL · verdict).
Do **not** ping at intermediate phases. The owner merges.

### 6. Cleanup, deploy, housekeeping, retro
- **Post-QA cleanup (each lane, as QA finishes):** kill any dev/preview servers the lane started and
  free their ports — a **per-PID loop** (`for pid in $(lsof -ti tcp:<port>); do kill "$pid"; done`;
  zsh won't split `$PIDS`), including the Node inspector **`9229`** and app ports (`3000`/`3254`/…).
  Leave no orphaned process or bound port.
- **Deploy (owner-gated, after merge):** `devops`/`md-deploy` if the change ships.
- **Housekeeping (per task, after merge):** close the issue, reconcile labels/status, **reflect
  delivered scope** on the issue (scope + ADR/spec/decision/commit links), and **prune the lane's
  worktree** (`git worktree remove <path>` — non-destructive once the branch is pushed/merged).
- **Retro (session-level):** run `md-learn` **once** over the whole batch — distill learnings, route
  to docs/memory/skill-gaps, **propose before writing**, append **one** decision-log line.

### 7. Traceability — the #1 rule (outranks speed)
Every load-bearing action leaves a durable trail on the **PR + issue + `docs/`**, posted **as the
bot** (`scripts/sdlc/bot-token.sh`; verify the author login — the token expires ~hourly). **Inject
this mandate into every sub-agent / lane prompt** — sub-agents do not inherit your memory. A
chat-only result is treated as **not done**.

## Delegates to
The phase skills via their agents — `md-research`, `md-write-prd`, `md-plan-architecture`,
`md-design-ui`, `md-create-story`, `md-groom-backlog`, `md-implement`, `md-review-pr`,
`md-qa-review`, `md-deploy`, `md-learn`; the **Workflow tool** (parallel fan-out + worktree
isolation); the **`code-simplifier` agent** (simplify phase). Re-use them — don't re-implement.

## Done when
Every input task has either **shipped** (merged + deployed + issue reconciled) or is **parked at
ready-to-merge** awaiting the owner; the batch **retro** is recorded; and the whole trail is visible
on **GitHub + `docs/`**.
