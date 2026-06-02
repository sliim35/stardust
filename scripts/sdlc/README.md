# scripts/sdlc

Glue scripts for the AI SDLC.

## `gh-app-token.mjs` — review-bot installation token

Mints a GitHub App **installation access token** (valid **~1 hour**) so `md-review-pr` can post PR
reviews as the App's own bot identity — **`reviewer-stardust-project[bot]`** — instead of as the
repo owner (`@sliim35`). It signs a short-lived (**~5 min**) App JWT, exchanges it for the
installation token, and prints **only** the token to stdout. Zero dependencies (Node 24 built-ins);
no third-party code touches the private key.

### Sourcing the key — 1Password at mint-time (ADR-0005)

The happy path **never leaves the key on disk** (ADR-0004 / ADR-0005). Source it from 1Password and
pipe it through the minter's raw env input:

```bash
BOT_TOKEN="$(GH_APP_PRIVATE_KEY="$(op read 'op://Integrations/<reviewer-app>/private key')" \
  node scripts/sdlc/gh-app-token.mjs)"
GH_TOKEN="$BOT_TOKEN" gh api repos/sliim35/stardust/pulls/<pr>/reviews ...   # posts as the bot
```

### Inputs (env)

| Var | Meaning | Source |
|---|---|---|
| `GH_APP_PRIVATE_KEY` | raw PEM (**secret**) — the happy path | `op read …` (1Password) |
| `GH_APP_PRIVATE_KEY_B64` | base64 PEM (**secret**) | cloud-agent **Agents secrets** env |
| `GH_APP_PRIVATE_KEY_PATH` | path to a `.pem` | **break-glass only** (1Password unavailable) — shred after use |
| `GH_APP_ID` | App id (default `3942207`) | non-secret |
| `GH_APP_INSTALLATION_ID` | installation id (default `137501061`) | non-secret |

### One-time owner setup (ADR-0005 — the agent can't self-apply these)

So the `reviewer` agent mints **unattended** locally, the **owner** applies these (an agent can't
widen its own permissions; the auto-mode classifier blocks self-modification):

1. Store the App `.pem` in **1Password** (vault `Integrations`, the ADR-0004 item) and **shred any
   local copy** — `rm ~/Downloads/reviewer-stardust-project.*.private-key.pem`. The resident `.pem`
   is **not** part of the happy path anymore (this shred is now mandatory cleanup, not optional).
2. Add to `.claude/settings.local.json` `permissions.allow`: `Bash(op read:*)` and
   `Bash(node scripts/sdlc/gh-app-token.mjs:*)` (the classifier's own denial says a matching allow
   rule overrides it).
3. Add `Bash(node scripts/sdlc/gh-app-token.mjs:*)` to `.claude/agents/reviewer.md` `tools:`.

The App grants only **Pull requests: write** (no Contents) — the bot can comment/review but
**cannot push code**; the installation token lasts ~1 h and the key is revocable from App settings.

Decision + alternatives: **ADR-0005**
(`docs/architecture/adr/0005-local-bot-token-1password-allowlist.md`); research note
`docs/research/2026-06-02-claude-review-bot-identity.md`. Swapping the hand-rolled JWT for the
local **`gh-token`** extension is tracked as an **open follow-up** (F2) — `actions/create-github-app-token`
is excluded (CI-only ⇒ a paid cloud run; reviews are local-only).
