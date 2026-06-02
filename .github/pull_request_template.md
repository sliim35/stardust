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
<!-- For any UI-affecting change, attach screenshots (before / after, or the rendered
     state) — drag images in here, or paste a deploy/preview URL. Write "N/A — no visual
     change" for pure logic/tooling/data PRs. -->

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
