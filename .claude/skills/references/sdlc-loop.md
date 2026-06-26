# The SDLC loop

The canonical path a unit of work travels. Each step names the **agent** / `skill` and the
artifact it touches. Not every step runs for every item — the **`md-workflow` mediator** picks the
entry point and skips phases that aren't needed (a typo fix may jump straight to developer).

```
                 ┌──────────────┐
   idea  ───────▶│  md-workflow │  routes + drives
                 └──────┬───────┘
                        ▼
  1. researcher   · md-research        → docs/research/*.md         (if unknowns)
  2. architect    · md-write-prd       → docs/product/*.md
  3. architect    · md-plan-architecture → architecture/overview.md + adr/NNNN-*.md
  4. ui-designer  · md-design-ui       → docs/design/*.md           (if visual)
  5. task-creator · md-create-story    → docs/stories/<id>-*.md  +  GitHub issue
  6. backlog-analyzer · md-groom-backlog → prioritize / label / reconcile
  7. developer    · md-implement       → src/ + tests  (TDD)        story: in-progress→in-review
  8. reviewer     · md-review-pr       → code-review verdict + learned rules → docs/conventions/code-style.md
  9. qa           · md-qa-review       → QA verdict + bug issues     (gate)
 10. devops       · md-deploy          → pnpm deploy + close issue
 11. md-workflow  · md-learn           → retro: distill the session → docs/ · memory · skill gaps  (after merge)
 12. md-workflow  → next prioritized story
```

## Gates (don't skip)

- No story → no implementation. (task-creator must run first.)
- No passing `pnpm check && pnpm test` → no QA sign-off. (verification-before-completion)
- No QA sign-off → no deploy.
- `reviewer` (`md-review-pr`) runs **before** QA and owns conventions/style + the learning
  loop. It is **advisory, not the correctness gate** — QA's sign-off is still required.

## Delegation

The `md-*` skills are thin wrappers around an SDLC phase + its doc artifact. The real
engineering process is the installed **superpowers** skills — `md-implement` delegates to
`test-driven-development`, `md-qa-review` to `verification-before-completion` and
`requesting-code-review`, `md-review-pr` to the built-in `code-review` skill,
`md-research` to `deep-research`, etc. Don't reimplement them.

`md-learn` (step 11) is the **ratified, routed** counterpart to the automatic `dream` memory
hook: it distills the session and routes each finding to `docs/`, memory, or a new-skill gap —
**proposing before writing** — and **flags** conventions to `md-review-pr` rather than writing
`code-style.md` itself.
