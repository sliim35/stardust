# CI/CD — GitHub Actions + 1Password (ADR-0004)

Implements [`docs/architecture/adr/0004-cicd-github-actions-1password.md`](../../docs/architecture/adr/0004-cicd-github-actions-1password.md).

- **`ci.yml`** — on every PR and push to `main`: `pnpm check` (Biome) · `pnpm test` (Vitest) ·
  `pnpm build` (Vite), on Node 24 / pnpm 10. Make these **required status checks** in branch
  protection so only green code reaches `main`.
- **`deploy.yml`** — on push to `main`: build, load secrets from 1Password, then `wrangler deploy`
  to Cloudflare Workers (`stardust-mdvoy-org`). Runs in the `production` GitHub Environment.

## Secrets — 1Password only

The **only** secret stored in GitHub is `OP_SERVICE_ACCOUNT_TOKEN` (a 1Password Service Account),
set on the `production` Environment. Everything else is read from 1Password at runtime via
`1password/load-secrets-action`, using `op://` references:

| Env var | 1Password reference |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `op://stardust/cloudflare/api-token` |
| `CLOUDFLARE_ACCOUNT_ID` | `op://stardust/cloudflare/account-id` |

(Adjust the vault/item/field names to match your 1Password layout, then update `deploy.yml`.)

## Owner bootstrap (one-time — required before the first deploy)

1. Create a 1Password **Service Account** with read access to the `stardust` vault; copy its token.
2. In that vault, create a `cloudflare` item with fields `api-token` (a **Workers-scoped**
   Cloudflare API token) and `account-id`.
3. GitHub → Settings → Environments → **`production`** → add secret
   `OP_SERVICE_ACCOUNT_TOKEN` = the service-account token.
4. (Recommended) Branch protection on `main`: require the **CI** checks before merge.

Future Worker runtime secrets (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`) follow the same pattern —
store in 1Password and push to the Worker via `wrangler secret put` fed from 1Password; never commit.
