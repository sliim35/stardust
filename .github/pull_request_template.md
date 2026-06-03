<!-- AI SDLC pull request -->

Closes #<issue>   <!-- or "Refs #<issue>" if the issue isn't fully done on merge -->

## Summary
What this change does and why, in 1–3 sentences.

## Story / context
- Story: `docs/stories/<id>-<slug>.md` (local/gitignored — summarize the goal here so the PR stands alone)
- Epic: #<epic> · Role: `role:<research|architecture|design|dev|qa|devops>`
- Design / ADR: `docs/architecture/adr/NNNN-*.md` · `docs/design/*` (if any)

## Acceptance criteria
- [ ] AC1
- [ ] AC2

## Verification (evidence required)
- [ ] `pnpm check` (Biome)
- [ ] `pnpm test` (Vitest)
- [ ] `pnpm build` (Vite)
- [ ] Behavior verified where relevant (smoke test / screenshot / deploy URL)

<details><summary>output</summary>

```
paste command output here
```

</details>

## Screenshots / visual evidence
<!-- For any UI-affecting change, evidence = the per-PR **preview deploy URL** (auto-posted
     by the Preview workflow as a sticky comment) + a short list of the states verified
     there. Drag-drop screenshots are browser-UI-only — automation/agents can't attach them
     via the API, so the live preview URL is the canonical evidence. Write "N/A — no visual
     change" for pure logic/tooling/data PRs. -->

**Verified at the preview deploy:** <paste the preview URL>
- [ ] <route / state verified>
- [ ] <route / state verified>

<!-- Optional: static before/after images, only if you dragged them in by hand. -->
| Before | After |
| --- | --- |
|  |  |

## Reviewer / QA checklist
- [ ] ACs met with evidence
- [ ] Scoped to the story — no unrelated changes
- [ ] SSR-safe on Workers — no module-scope `Math.random()` / `Date.now()`, no Node-only runtime APIs
- [ ] Secrets via 1Password — none committed or added as plaintext GitHub secrets (ADR-0004)
- [ ] Docs updated if structure changed (`docs/architecture/overview.md`, decision-log)

## Notes
Follow-ups, decisions, anything a reviewer should know.
