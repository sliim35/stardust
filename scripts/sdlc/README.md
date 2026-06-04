# scripts/sdlc

Glue scripts for the AI SDLC.

## Review-bot installation token — cached `bot-token.sh` front-door (ADR-0005, F2 resolved; #100)

`md-review-pr` posts its review as the App's own bot identity — **`reviewer-stardust-project[bot]`** —
instead of as the repo owner (`@sliim35`). Get the token from the **cached helper
`scripts/sdlc/bot-token.sh`**: it prints a valid installation token and only **re-mints when the
cached one nears expiry**, so the `op` key-read (and its approval prompt) fires **~once an hour, not
on every review** (#100):

```bash
GH_TOKEN="$(scripts/sdlc/bot-token.sh)" \
  gh api repos/sliim35/stardust/pulls/<pr>/reviews ...   # posts as the bot
scripts/sdlc/bot-token.sh --status   # show remaining TTL; never mints
scripts/sdlc/bot-token.sh --clear    # drop the cache (e.g. after a key/App rotation)
```

On a **cache miss** the helper mints with the **`gh-token`** extension, sourcing the App key from
**1Password at mint-time** (never a resident file) — equivalently, the uncached one-liner (also the
no-cache fallback):

```bash
BOT_TOKEN="$(gh token generate \
  --app-id 3942207 --installation-id 137501061 \
  --base64-key "$(op read 'op://Integrations/github app/credential')" \
  --token-only)"
GH_TOKEN="$BOT_TOKEN" gh api repos/sliim35/stardust/pulls/<pr>/reviews ...
```

- **What's cached:** only the **derived token** (~1 h, PRs:write, repo-scoped, revocable), written
  `0600` to `${XDG_CACHE_HOME:-~/.cache}/stardust-sdlc/bot-token`, **outside the repo**. The App
  **private key never touches disk** — ADR-0004/0005's no-resident-key rule still holds (we cache the
  token the key produced, not the key). TTL is a conservative 55 min (5-min skew under GitHub's ~1 h).
- The `op` field (`…/credential`) stores the key **base64-encoded**, so `--base64-key` reads it
  directly — no file, nothing on disk, no inline re-encoding. `--token-only` prints just the token (**no `jq`**).
- **Token is opaque — never parse or length-check it.** GitHub is migrating installation tokens to a
  **stateless `ghs_<appid>_<jwt>`** format (~520 chars, two dots) vs the classic short opaque string;
  the helper and `gh` treat it as an opaque string, so the change is a non-event (#100, ADR-0005).
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
   (and `Bash(gh token:*)` if your local auto-mode gates it). **No `Bash(node …)` grant** — that's
   the simplification over the retired hand-rolled minter.
4. **(Optional, for caching)** To let the `reviewer` agent call the cached helper unattended, add
   **`Bash(scripts/sdlc/bot-token.sh:*)`** to `permissions.allow` **and** to `.claude/agents/reviewer.md`
   `tools:` — one small owner-manual grant (an agent can't widen its own perms). **Skip it and nothing
   breaks:** the agent just falls back to the inline `gh token generate` recipe under its existing
   `Bash(gh:*)` (per-review `op` prompt, no caching).

**Local prerequisite:** `op` (1Password CLI) installed and an **authenticated session** (`op signin`),
plus the `gh-token` extension. With no key, `md-review-pr` falls back to your own `gh` auth (posts as
you) — the bot never blocks a review.

The App grants only **Pull requests: write** (no Contents) — the bot can comment/review but **cannot
push code**; tokens last ~1 h and the key is revocable from App settings. **Supply-chain note:**
`gh-token` is a third-party Go extension that receives the App private key — pin it to a reviewed
version; the residual risk is bounded by the least-privilege App + short-lived tokens.

Decision + alternatives: **ADR-0005** (F2 resolved) ·
`docs/research/2026-06-02-gh-token-vs-handrolled-minter.md` · spike #43. Caching + the stateless-token
analysis: spike **#100** · `docs/research/2026-06-04-stateless-installation-tokens-bot-identity.md`.
The zero-dependency minter (`gh-app-token.mjs`) it replaces is recoverable from git history if a
no-extension fallback is ever needed.
