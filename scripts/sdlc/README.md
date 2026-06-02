# scripts/sdlc

Glue scripts for the AI SDLC.

## `gh-app-token.mjs` — review-bot installation token

Mints a short-lived (~8 min) GitHub App **installation access token** so `md-review-pr` can
post PR reviews as the App's own bot identity — **`reviewer-stardust-project[bot]`** — instead
of as the repo owner (`@sliim35`). Zero dependencies (Node 24 built-ins only); no third-party
code ever touches the private key. Prints **only** the token to stdout:

```bash
BOT_TOKEN="$(node scripts/sdlc/gh-app-token.mjs)"
GH_TOKEN="$BOT_TOKEN" gh api repos/sliim35/stardust/pulls/<pr>/reviews ...   # posts as the bot
```

### Inputs (env)

| Var | Meaning | Where |
|---|---|---|
| `GH_APP_PRIVATE_KEY_B64` | base64 of the App `.pem` (**secret**) | agent secrets / env |
| `GH_APP_PRIVATE_KEY` · `GH_APP_PRIVATE_KEY_PATH` | raw PEM · path to `.pem` (alternatives) | — |
| `GH_APP_ID` | App id (default `3942207`) | non-secret |
| `GH_APP_INSTALLATION_ID` | installation id (default `137501061`) | non-secret |

### Where the key lives — and where the bot can run

The private key is stored as `GH_APP_PRIVATE_KEY_B64` in the repo's **Agents secrets**
(GitHub → Settings → *Agents secrets and variables*). That value is injected **only into GitHub
cloud-agent runs**, so:

- **Cloud-agent run** → the env var is present; the script mints a token automatically → reviews post as the bot.
- **Local run** (Claude Code on your machine) → the cloud secret isn't visible; point the script
  at a local key (`GH_APP_PRIVATE_KEY_PATH=/path/to.pem`, or export `GH_APP_PRIVATE_KEY_B64`) to
  post as the bot. With **no** key present, `md-review-pr` gracefully falls back to your own `gh`
  auth (posts as you) — the bot never blocks a review.

The App grants only **Pull requests: write** (no Contents) — the bot can comment/review but
**cannot push code**; tokens expire in ~8 minutes and the key is revocable from the App settings.

### Permissions for the `reviewer` agent

For the `reviewer` subagent to mint tokens unattended, its `tools:` in
`.claude/agents/reviewer.md` must allow the script:

```
Bash(node scripts/sdlc/gh-app-token.mjs:*)
```

Setup rationale & options: `docs/research/2026-06-02-claude-review-bot-identity.md`.
