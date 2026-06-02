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
| `CLOUDFLARE_API_TOKEN` | `op://Integrations/Cloudflare/password` |
| `CLOUDFLARE_ACCOUNT_ID` | `op://Integrations/Cloudflare/username` |

(Mapped to the `Integrations` vault → `Cloudflare` item: `username` = account ID, `password` = token.)

## Owner bootstrap (one-time — required before the first deploy)

1. ✅ 1Password: vault **`Integrations`** → item **`Cloudflare`** with `username` = Cloudflare
   **account ID** and `password` = a **Workers-scoped API token**.
2. Create a 1Password **Service Account** with **read access to the `Integrations` vault**; copy its token.
3. GitHub → Settings → Environments → **New environment** named **`production`** → add an
   environment secret `OP_SERVICE_ACCOUNT_TOKEN` = the service-account token.
4. (Recommended) Branch protection on `main`: require the **CI** check before merge.

Future Worker runtime secrets (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`) follow the same pattern —
store in 1Password and push to the Worker via `wrangler secret put` fed from 1Password; never commit.
