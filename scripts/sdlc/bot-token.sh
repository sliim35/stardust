#!/usr/bin/env bash
#
# bot-token.sh — print a valid `reviewer-stardust-project[bot]` installation token,
# minting via 1Password + the `gh-token` extension ONLY when the cached token is
# missing or about to expire. (ADR-0005 · scripts/sdlc/README.md)
#
# Why: installation tokens live ~1 h, but the previous flow minted a fresh one on
# every call — re-reading the App key from 1Password each time (a per-request `op`
# approval prompt). Caching the *derived token* collapses that to ~one approval/hour.
#
# What is cached: ONLY the short-lived, least-privilege (PRs:write, repo-scoped,
# revocable) installation token — written 0600 to a cache dir OUTSIDE the repo. The
# App PRIVATE KEY is never written to disk (ADR-0004/0005 stay satisfied — we cache
# the token the key produces, not the key).
#
# Usage:
#   GH_TOKEN="$(scripts/sdlc/bot-token.sh)" gh api repos/sliim35/stardust/pulls/<n>/reviews ...
#   scripts/sdlc/bot-token.sh --status   # show cache state + remaining TTL, never mints
#   scripts/sdlc/bot-token.sh --clear    # drop the cached token (force re-mint next call)
#
# Prereqs: `op` (authenticated session) + the `gh-token` extension (Link-/gh-token).
# With no key/op, the caller should fall back to its own `gh` auth (posts as you).
set -euo pipefail

APP_ID=3942207
INSTALL_ID=137501061
OP_REF='op://Integrations/github app/credential'
TTL=3300   # serve a cached token for 55 min; GitHub installation tokens last ~1 h (5-min skew)

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/stardust-sdlc"
CACHE_FILE="$CACHE_DIR/bot-token"   # line 1 = expiry epoch, line 2 = token (opaque; never parsed)

epoch_now() { date -u +%s; }

# Print the cached token iff it exists and is still within TTL; else fail (caller mints).
read_cache() {
  [ -f "$CACHE_FILE" ] || return 1
  local exp tok
  exp="$(sed -n 1p "$CACHE_FILE")"
  tok="$(sed -n 2p "$CACHE_FILE")"
  [ -n "$exp" ] && [ -n "$tok" ] || return 1
  [ "$exp" -gt "$(epoch_now)" ] 2>/dev/null || return 1
  printf '%s\n' "$tok"
}

# Mint a fresh token (reads the App key from 1Password), cache it 0600, print it.
mint() {
  mkdir -p "$CACHE_DIR"; chmod 700 "$CACHE_DIR"
  local tok
  tok="$(gh token generate --app-id "$APP_ID" --installation-id "$INSTALL_ID" \
    --base64-key "$(op read "$OP_REF")" --token-only)"
  [ -n "$tok" ] || { echo "bot-token: mint failed (op read denied or gh-token error)" >&2; return 1; }
  ( umask 177; printf '%s\n%s\n' "$(( $(epoch_now) + TTL ))" "$tok" > "$CACHE_FILE" )
  printf '%s\n' "$tok"
}

case "${1:-}" in
  --status)
    if [ -f "$CACHE_FILE" ]; then
      exp="$(sed -n 1p "$CACHE_FILE")"; remain=$(( exp - $(epoch_now) ))
      if [ "$remain" -gt 0 ]; then echo "cached: valid, ~${remain}s (~$(( remain / 60 ))m) left";
      else echo "cached: EXPIRED ${remain#-}s ago"; fi
    else echo "cached: none"; fi
    ;;
  --clear)
    rm -f "$CACHE_FILE" && echo "bot-token: cache cleared"
    ;;
  "")
    read_cache || mint
    ;;
  *)
    echo "bot-token: unknown arg '$1' (use --status | --clear | no arg)" >&2; exit 2
    ;;
esac
