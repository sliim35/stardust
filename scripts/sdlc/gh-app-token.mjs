#!/usr/bin/env node
// Mint a short-lived GitHub App *installation access token* for the stardust review app
// (slug `reviewer-stardust-project`), so `md-review-pr` can post PR reviews as
// `reviewer-stardust-project[bot]` instead of as the repo owner.
//
// Zero dependencies — Node 24 built-ins only (node:crypto + global fetch). No third-party
// code ever touches the App private key. Prints ONLY the token to stdout:
//
//   BOT_TOKEN="$(GH_APP_PRIVATE_KEY="$(op read 'op://Integrations/<reviewer-app>/private key')" \
//     node scripts/sdlc/gh-app-token.mjs)"
//   GH_TOKEN="$BOT_TOKEN" gh api repos/sliim35/stardust/pulls/<pr>/reviews ...
//
// The private key is read from the environment — never a resident file on the happy path (ADR-0005):
//   GH_APP_PRIVATE_KEY_B64   base64 PEM  — cloud-agent runs (injected from GitHub Agents secrets)
//   GH_APP_PRIVATE_KEY       raw PEM     — local happy path: GH_APP_PRIVATE_KEY="$(op read 'op://…')"
//   GH_APP_PRIVATE_KEY_PATH  path to .pem — BREAK-GLASS only (1Password unavailable); shred after use
// App/installation ids default to the stardust review app (non-secret), override via env:
//   GH_APP_ID                default 3942207
//   GH_APP_INSTALLATION_ID   default 137501061

import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const APP_ID = process.env.GH_APP_ID ?? '3942207'
const INSTALLATION_ID = process.env.GH_APP_INSTALLATION_ID ?? '137501061'

const die = (msg) => {
  process.stderr.write(`gh-app-token: ${msg}\n`)
  process.exit(1)
}

const loadPem = () => {
  const { GH_APP_PRIVATE_KEY_B64, GH_APP_PRIVATE_KEY, GH_APP_PRIVATE_KEY_PATH } = process.env
  if (GH_APP_PRIVATE_KEY_B64) return Buffer.from(GH_APP_PRIVATE_KEY_B64, 'base64').toString('utf8')
  if (GH_APP_PRIVATE_KEY) return GH_APP_PRIVATE_KEY
  if (GH_APP_PRIVATE_KEY_PATH) return readFileSync(GH_APP_PRIVATE_KEY_PATH, 'utf8')
  return die('no private key — source from 1Password (GH_APP_PRIVATE_KEY via op read), or set GH_APP_PRIVATE_KEY_B64 (cloud) / GH_APP_PRIVATE_KEY_PATH (break-glass)')
}

const b64url = (input) =>
  Buffer.from(input).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

// Sign a GitHub App JWT (RS256). exp ~5 min out with iat backdated 60s for clock skew,
// keeping the window comfortably under GitHub's 10-minute maximum.
const mintJwt = (pem) => {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 300, iss: APP_ID }))
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(pem, 'base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
  return `${header}.${payload}.${signature}`
}

const main = async () => {
  const jwt = mintJwt(loadPem())
  const res = await fetch(`https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'stardust-claude-reviewer',
    },
  })
  if (!res.ok) return die(`installation-token request failed: ${res.status} ${res.statusText} — ${await res.text()}`)
  const { token } = await res.json()
  if (!token) return die('no token in response')
  process.stdout.write(token)
}

main().catch((err) => die(err?.message ?? String(err)))
