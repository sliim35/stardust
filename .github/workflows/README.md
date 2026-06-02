# CI/CD — GitHub Actions + 1Password (ADR-0004)

Implements [`docs/architecture/adr/0004-cicd-github-actions-1password.md`](../../docs/architecture/adr/0004-cicd-github-actions-1password.md).

- **`ci.yml`** — on every PR and push to `main`: `pnpm check` (Biome) · `pnpm test` (Vitest) ·
  `pnpm build` (Vite), on Node 24 / pnpm 10. Make these **required status checks** in branch
  protection so only green code reaches `main`.
- **`deploy.yml`** — on push to `main`: build, load secrets from 1Password, then `wrangler deploy`
  to Cloudflare Workers (`stardust-mdvoy-org`). Runs in the `production` GitHub Environment.
- **`preview.yml`** — on every **PR** to `main`: build, then `wrangler versions upload` to deploy a
  Cloudflare Workers **preview version** (never production traffic) and post its URL as a **sticky
  PR comment** so QA can verify visually before merge. Runs in a dedicated **`preview`** GitHub
  Environment. Uses `pull_request` (not `pull_request_target`), so it **skips fork PRs** (no secret
  access) and **never blocks merge** (not a required check). Degrades gracefully — green + a setup
  hint — until the `preview` environment has `OP_SERVICE_ACCOUNT_TOKEN`.

## Secrets — 1Password only

The **only** secret stored in GitHub is `OP_SERVICE_ACCOUNT_TOKEN` (a 1Password Service Account),
set on the `production` Environment (and, for PR previews, the `preview` Environment — same token
value). Everything else is read from 1Password at runtime via
`1password/load-secrets-action`, using `op://` references:

| Env var | 1Password reference |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `op://Integrations/Cloudflare/password` |
| `CLOUDFLARE_ACCOUNT_ID` | `op://Integrations/Cloudflare/username` |

(Mapped to the `Integrations` vault → `Cloudflare` item: `username` = account ID, `password` = token.)

## Owner bootstrap (one-time)

**For production deploys (`deploy.yml`):**

1. ✅ 1Password: vault **`Integrations`** → item **`Cloudflare`** with `username` = Cloudflare
   **account ID** and `password` = a **Workers-scoped API token**.
2. Create a 1Password **Service Account** with **read access to the `Integrations` vault**; copy its token.
3. GitHub → Settings → Environments → **New environment** named **`production`** → add an
   environment secret `OP_SERVICE_ACCOUNT_TOKEN` = the service-account token.
4. (Recommended) Branch protection on `main`: require the **CI** check before merge.

**For PR preview deploys (`preview.yml`):**

5. GitHub → Settings → Environments → **New environment** named **`preview`** → add the **same**
   `OP_SERVICE_ACCOUNT_TOKEN` secret. A separate environment keeps previews decoupled from any
   production protection rules. Until it exists, `preview.yml` runs green and posts a setup hint
   instead of deploying.
6. Ensure the account has a **`workers.dev` subdomain** (the default for new Workers) so the Worker
   has **Preview URLs** — `wrangler versions upload` prints the `Version Preview URL` the workflow
   posts to the PR. No teardown is needed; preview versions never serve production traffic.

Future Worker runtime secrets (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`) follow the same pattern —
store in 1Password and push to the Worker via `wrangler secret put` fed from 1Password; never commit.
