# scripts/sdlc

Glue scripts for the AI SDLC.

## Review-bot installation token — via the `gh-token` extension (ADR-0005, F2 resolved)

`md-review-pr` posts its review as the App's own bot identity — **`reviewer-stardust-project[bot]`** —
instead of as the repo owner (`@sliim35`). The installation token (valid **~1 h**) is minted with the
**`gh-token`** gh extension, with the App private key sourced from **1Password at mint-time** (never a
resident file):

```bash
BOT_TOKEN="$(gh token generate \
  --app-id 3942207 --installation-id 137501061 \
  --base64-key "$(op read 'op://Integrations/github app/credential')" \
  --token-only)"
GH_TOKEN="$BOT_TOKEN" gh api repos/sliim35/stardust/pulls/<pr>/reviews ...   # posts as the bot
```

- The `op` field (`…/credential`) stores the key **base64-encoded**, so `--base64-key` reads it
  directly — no file, nothing on disk, no inline re-encoding.
- `--token-only` prints just the token (**no `jq`**).
- `gh token generate` is a `gh` subcommand → runs under the `reviewer` agent's existing `Bash(gh:*)`.
- App ids are non-secret (review app `reviewer-stardust-project`); `--installation-id` could be omitted
  (gh-token defaults to the first install) but is pinned here for determinism.

### One-time owner setup (an agent can't self-apply the perms)
1. **Install the extension** — `gh extension install Link-/gh-token`. Pin it to a reviewed
   release/commit for supply-chain hygiene.
2. **Store the App key (base64) in 1Password** — item **`github app`** (vault `Integrations`), field
   **`credential`** = `base64 -i key.pem | tr -d '\n'` (a one-liner; the concealed field is single-line,
   so base64 sidesteps PEM newline-stripping). Then **shred the local copy** —
   `rm ~/Downloads/reviewer-stardust-project.*.private-key.pem`. No resident key.
3. **Allow the key-touch** in `.claude/settings.local.json` `permissions.allow`: **`Bash(op read:*)`**
   (and `Bash(gh token:*)` if your local auto-mode gates it). **No `Bash(node …)` grant and no
   `reviewer.md` `tools:` edit** — that's the simplification over the retired hand-rolled minter.

**Local prerequisite:** `op` (1Password CLI) installed and an **authenticated session** (`op signin`),
plus the `gh-token` extension. With no key, `md-review-pr` falls back to your own `gh` auth (posts as
you) — the bot never blocks a review.

The App grants only **Pull requests: write** (no Contents) — the bot can comment/review but **cannot
push code**; tokens last ~1 h and the key is revocable from App settings. **Supply-chain note:**
`gh-token` is a third-party Go extension that receives the App private key — pin it to a reviewed
version; the residual risk is bounded by the least-privilege App + short-lived tokens.

Decision + alternatives: **ADR-0005** (F2 resolved) ·
`docs/research/2026-06-02-gh-token-vs-handrolled-minter.md` · spike #43. The zero-dependency minter
(`gh-app-token.mjs`) it replaces is recoverable from git history if a no-extension fallback is ever
needed.
