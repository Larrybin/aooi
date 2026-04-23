# Roller Rabbit - Development Guide

This file is the engineering operations guide for running, validating, and deploying the repo.

For the product-level split between mainline and optional modules, use the single source of truth in `docs/guides/module-contract.md`. Do not treat this file as the place to redefine module tiers or verification labels.

Current production build policy: `scripts/next-build.mjs` forces `next build --webpack`. Local dev can still use Turbopack, but Cloudflare deploys are pinned to Webpack until the Turbopack/OpenNext Worker runtime issue is resolved.

## Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database

## Project Initialization and Local Development

Starting a new project with environment configuration

```bash
# Clone the repository
git clone git@github.com:Larrybin/aooi.git my-project
cd my-project

# Install dependencies
pnpm install

# Create environment configuration
cp .env.example .env

# Configure DATABASE_URL / secrets in .env, then run migrations
pnpm db:migrate

# Start development server
pnpm dev

# Start on custom port
pnpm dev --port 8080
```

## Database Configuration and Migration

Setting up PostgreSQL database with Drizzle ORM

```toml
# .env configuration
DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/my_project"
DATABASE_PROVIDER = "postgresql"

# Traditional server (Docker/VPS): enable pooling
DB_SINGLETON_ENABLED = "true"

# Serverless Node runtime: disable pooling (max=1 cached client)
# DB_SINGLETON_ENABLED = "false"
```

Notes:

- `DATABASE_PROVIDER` currently supports `postgresql` only.
- Cloudflare Workers runtime uses Hyperdrive (`HYPERDRIVE.connectionString`) and ignores `DATABASE_URL`. Ensure `nodejs_compat` is enabled and configure it in the tracked Wrangler templates, but keep `localConnectionString = ""` there and inject local DSNs only through generated temporary configs.
- Production `src/instrumentation.ts` now validates auth secret presence only. Database readiness and schema validation are enforced at query time inside `src/core/db/index.ts`; there is no longer a production DB startup probe in instrumentation.
- Cloudflare preview is removed from the supported contract. The repo now targets a router Worker plus the canonical `public-web/auth/payment/member/chat/admin` server Workers with version affinity.
- `pnpm cf:check` validates the router + server Wrangler configs against `src/shared/config/cloudflare-worker-splits.ts`.
- `pnpm cf:build` runs the OpenNext multi-bundle build and hard-fails if any required Worker bundle is missing or if `wrangler versions upload --dry-run` reports a deployable gzip bundle `>= 3 MiB`.
- `pnpm test:cf-admin-settings-smoke` is the Cloudflare-only local acceptance gate for storage semantics. It always runs `pnpm cf:build` first, seeds settings directly in Postgres, exercises the real `/api/storage/upload-image` route inside one local Cloudflare runtime session, and then verifies public config projection plus the `STORAGE_PUBLIC_BASE_URL` missing-error path.
- `pnpm test:cf-local-smoke` is the canonical local Cloudflare runtime gate. It generates the full temporary topology, verifies the required `.open-next` artifacts exist, starts the router plus all server Workers through one `wrangler dev` multi-config session, and finally runs the read-only smoke against the router origin. `scripts/run-cf-local-smoke.mjs` backfills `DATABASE_URL` / `AUTH_SPIKE_DATABASE_URL` from `.dev.vars` (or `CF_LOCAL_SMOKE_DEV_VARS_PATH`) when they are missing, and local smoke runtime seeds the public docs/AI config toggles so the read-only path does not depend on preloaded DB config rows.
- `pnpm cf:deploy` is the only supported Cloudflare deploy entry. It bootstraps brand-new Workers with `wrangler deploy`, and uses version-affinity rollout for steady-state deploys.
- Multi-worker Cloudflare auth requires the same `BETTER_AUTH_SECRET` on the router Worker and every `cloudflare/wrangler.server-*.toml` Worker; missing the secret on any server Worker will surface as production 500s during instrumentation startup.
- `pnpm test:cf-app-smoke` is the post-deploy production read-only smoke. It covers public entrypoints, image routing, and same-origin protected-route redirects back to `/sign-in`.
- `pnpm test:creem-webhook-spike` covers Creem webhook signature verification and duplicate renewal idempotency.
- `pnpm test:r2-upload-spike` covers R2 upload success/failure semantics (valid image, invalid MIME, provider init failure, upload failure).
- `.github/workflows/dual-deploy-acceptance.yaml` keeps Cloudflare CI on `pnpm cf:check`, `pnpm cf:build`, and `pnpm test:cf-local-smoke`.
- Cloudflare state is governed as `first-class` / `preview-only` / `blocked`; see `docs/architecture/dual-deploy-governance.md`.
- Auth spike raw conclusions now have explicit governance actions; use the decision table in `docs/architecture/dual-deploy-governance.md` instead of inferring policy from exit codes.
- Current repo status is `ready` for Cloudflare multi-worker build, local smoke, and real deploy validation through the canonical scripts above. On April 15, 2026, `pnpm cf:build` measured the deployable gzip sizes as `public-web 2.21 MiB`, `member 1.91 MiB`, `admin 1.75 MiB`, `payment 1.58 MiB`, `chat 1.50 MiB`, `auth 1.23 MiB`, `router 0.14 MiB`.
- Cloudflare topology is fixed: `site.brand.appUrl` from the explicit `SITE` config is the canonical app/auth origin. `NEXT_PUBLIC_APP_URL` is generated as an infra artifact from that value, and `AUTH_URL` / `BETTER_AUTH_URL` may only exist as same-origin mirrors.
- Production Cloudflare routing is fixed in `wrangler.cloudflare.toml`: `workers_dev = false`, `preview_urls = false`, and the router Worker is bound through `[[routes]]` as the custom domain.
- Runtime-specific code must stay inside `src/shared/lib/runtime/**`; see `docs/architecture/runtime-boundary.md`.
- For details, see `docs/guides/database.md`.

```bash
# Generate and migrate database tables
pnpm db:generate
pnpm db:migrate

# Verify database connection
psql "postgresql://user:password@address:port/database"
```

## Authentication Setup with Better Auth

Configuring user authentication and admin access

```bash
# Generate authentication secret
openssl rand -base64 32
```

```toml
# .env configuration
# BETTER_AUTH_SECRET is preferred; AUTH_SECRET is supported as a fallback.
BETTER_AUTH_SECRET = "your-generated-secret-key"
# AUTH_SECRET = "your-generated-secret-key"
```

```bash
# Initialize RBAC permissions
pnpm rbac:init

# Assign super admin role to user
pnpm rbac:assign -- --email=admin@example.com --role=super_admin
```

For details, see `docs/guides/auth.md` and `docs/guides/rbac.md`.

## Google OAuth Login Integration

Enabling Google Sign-In and One-Tap Login

```bash
# Google OAuth callback URL format
https://your-domain.com/api/auth/callback/google

# Authorized JavaScript origins
https://your-domain.com
```

Configuration in Admin Dashboard at `/<locale?>/admin/settings/auth`:

- Navigate to Settings → Auth → Google Auth
- Enter Client ID and Client secret from Google Cloud Console
- Enable "Auth Enabled" for Google redirect login
- Enable "OneTap Enabled" for Google One-Tap login

## Stripe Payment Integration

Configuring Stripe for one-time payments and subscriptions

```json
{
  "pricing": {
    "items": [
      {
        "title": "Starter",
        "description": "Get started with your first SaaS startup.",
        "interval": "one-time",
        "amount": 9900,
        "currency": "USD",
        "price": "$99",
        "original_price": "$199",
        "product_id": "starter",
        "product_name": "Starter Plan",
        "credits": 100,
        "valid_days": 30,
        "group": "one-time"
      }
    ]
  }
}
```

```bash
# Create checkout session - API endpoint
# Note: this endpoint requires an authenticated user session.
POST /api/payment/checkout
Content-Type: application/json

{
  "product_id": "starter",
  "currency": "usd",
  "locale": "en",
  "payment_provider": "stripe",
  "metadata": {}
}

# Stripe webhook configuration
# Events to monitor:
# - checkout.session.completed
# - invoice.payment_succeeded
# - invoice.payment_failed
# - customer.subscription.updated
# - customer.subscription.deleted

# Webhook endpoint URL
https://your-domain.com/api/payment/notify/<provider>
```

For full checkout/callback/webhook flow and supported providers, see `docs/guides/payment.md`.

## Multi-Currency Payment Configuration

Supporting multiple currencies with automatic conversion

```json
{
  "amount": 9900,
  "currency": "usd",
  "price": "$99",
  "original_price": "$199",
  "currencies": [
    {
      "currency": "cny",
      "amount": 69900,
      "price": "¥699",
      "original_price": "¥1399"
    }
  ]
}
```

## Cloudflare R2 Storage Integration

Configuring Cloudflare-only public asset delivery for uploaded files and brand assets.

Configuration:

- Set runtime binding `STORAGE_PUBLIC_BASE_URL`
- Uploads require `APP_STORAGE_R2_BUCKET` binding plus `STORAGE_PUBLIC_BASE_URL`

## Resend Email Service Integration

Sending transactional emails with templates

```bash
# Test email sending
# NOTE: this endpoint requires a logged-in admin session (cookie auth) + CSRF checks.
# A plain curl without session cookies will return 401/403.
curl -X POST https://your-domain.com/api/email/test \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-domain.com" \
  -H "Cookie: <paste your session cookies here>" \
  -d '{
    "emails": ["support@example.com"],
    "subject": "Test Email"
  }'

# Expected response
{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "messageId": "xxx",
    "provider": "resend"
  }
}
```

```typescript
// Send email (server-only)
import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { getEmailService } from '@/shared/services/email';

const emailService = await getEmailService();
const result = await emailService.sendEmail({
  to: ['support@example.com'],
  subject: 'Verification Code',
  ...buildVerificationCodeEmailPayload({ code: '123456' }),
});
```

## Environment Variables Configuration

Managing configuration across development and production

```typescript
// Client-safe config (usable in both Server/Client Components)
import { envConfigs } from '@/config';
// Server-only config (DO NOT import in client components)
import { serverEnv } from '@/config/server';

envConfigs.theme;
envConfigs.locale;

serverEnv.databaseUrl;
serverEnv.dbSingletonEnabled;
serverEnv.authBaseUrl;
serverEnv.authSecret;
```

Notes:

- `.env` is used for bootstrap settings (app URL/name/theme/locale), database connection (`DATABASE_URL`), and secrets (`BETTER_AUTH_SECRET` / `AUTH_SECRET`).
- Most third-party integration configs (payment/email/storage/analytics/etc) are stored in the config table and managed via `/<locale?>/admin/settings/<tab>` (see `docs/guides/settings.md`).
- Do not put secrets in `NEXT_PUBLIC_*` variables.

## Application Branding and Customization

Configuring app metadata and assets

```toml
# .env - Local development
NEXT_PUBLIC_APP_URL = "http://localhost:3000"
NEXT_PUBLIC_THEME = "default"

# .env.production - Production deployment
NEXT_PUBLIC_APP_URL = "https://your-domain.com"
```

Configure brand identity in `sites/<site-key>/site.config.json`. Runtime settings no longer own app identity fields.

SEO files:

- Sitemap: `src/app/sitemap.ts` (dynamic)
- Robots: `src/app/robots.ts`

## Cloudflare Deployment

Cloudflare Workers is the only supported production deployment target.

Deployment and acceptance commands:

```bash
pnpm cf:check
pnpm cf:build
pnpm cf:deploy
pnpm test:cf-local-smoke
pnpm test:cf-admin-settings-smoke
# Optional when a deployed environment exists
pnpm test:cf-app-smoke
```

Production contract:

1. Keep `DEPLOY_TARGET=cloudflare` in the tracked Wrangler templates.
2. Bind the shared OpenNext cache bucket as `NEXT_INC_CACHE_R2_BUCKET`.
3. Bind the business upload bucket as `APP_STORAGE_R2_BUCKET`.
4. Bind router image optimization as `IMAGES`.
5. Configure `STORAGE_PUBLIC_BASE_URL` before uploads.
6. Use the same `BETTER_AUTH_SECRET` / `AUTH_SECRET` across router and all server Workers.

Local acceptance notes:

- `pnpm test:cf-local-smoke` is the canonical Cloudflare local runtime gate.
- `pnpm test:cf-admin-settings-smoke` is the Cloudflare-only admin/settings brand storage gate.
- The admin/settings smoke uses the config API ready probe, then separately validates upload, restart, public config projection, and the explicit `STORAGE_PUBLIC_BASE_URL is not configured` failure path.

## Admin Dashboard Configuration

Visual configuration management at `/<locale?>/admin/settings/<tab>`

Key configuration categories accessible via Admin Dashboard:

**General Settings:**

- Initial credits for new users
- App name, description, logo, preview image

**Authentication:**

- Email authentication toggle
- Google OAuth (Client ID, Client Secret, One-Tap)
- GitHub OAuth (Client ID, Client Secret)

**Payment:**

- Default payment provider selection
- Stripe (API keys, webhook secret, payment methods, promotion codes)
- PayPal (Environment, Client ID, Client Secret)

**Storage:**

- `STORAGE_PUBLIC_BASE_URL`
- Uploads depend on `APP_STORAGE_R2_BUCKET` + `STORAGE_PUBLIC_BASE_URL`

**Email:**

- Resend (API Key, Sender Email)

**AI Providers:**

- OpenRouter (API Key, Base URL)
- Replicate (API Token, custom storage)
- Fal (API Key, custom storage)
- Gemini (API Key)

**Analytics:**

- Google Analytics ID
- Microsoft Clarity ID
- Plausible (Domain, Script Source)
- OpenPanel Client ID

**Customer Service:**

- Crisp (Website ID)
- Tawk (Property ID, Website ID)

**Affiliate Marketing:**

- Affonso (Program ID, Cookie Duration)
- PromoteKit (Program ID)

## Summary

Roller Rabbit serves as a comprehensive foundation for launching AI SaaS products, dramatically reducing time-to-market by providing production-ready implementations of common SaaS features. The framework is particularly valuable for indie developers and small teams who need to quickly validate business ideas without building infrastructure from scratch. Core use cases include AI-powered web applications, subscription-based SaaS products, content platforms with payment processing, and multi-tenant applications requiring user management and role-based access control.

The framework's integration patterns emphasize configuration over coding, with most features enabled through the admin dashboard (DB-backed configs) and a small set of bootstrap environment variables rather than custom code. The modular architecture allows selective feature adoption - developers can use only the landing page system for static sites, or progressively add authentication, payments, and AI capabilities as needed. Roller Rabbit is now converged on Cloudflare Workers for production deployment and integrates with common third-party services such as Stripe, Resend, and Cloudflare R2. The built-in i18n system, theme customization, and content management make it suitable for global audiences and diverse branding requirements.
