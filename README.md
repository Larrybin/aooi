# Roller Rabbit

A production-ready AI SaaS template built with Next.js App Router, TypeScript, and modern tooling.

## Product Contract

Roller Rabbit now treats the repo as:

- a **mainline** shell you can ship on day one
- a set of **optional modules** you enable later

The single source of truth for that split is [Module Contract](docs/guides/module-contract.md).

Mainline today:

- Core shell
- Auth
- Billing
- Admin Settings
- Deploy contract

Optional modules today:

- Docs / Blog
- AI
- Storage
- Analytics / Affiliate / Customer Service / Ads

## Architecture Overview

```
src/
├── app/           # Route-only: Next.js routes, layouts, route handlers
├── features/      # Product surfaces: admin / web / docs
├── core/          # Foundation: auth, database, i18n, docs source, theme
├── shared/        # Cross-surface primitives, services, utilities, types
├── extensions/    # Third-party integrations (payment, AI, storage)
├── config/        # Configuration, DB schema, locale messages
└── themes/        # UI themes

docs/              # Engineering documentation
content/           # MDX content (docs, blog, legal pages)
scripts/           # Maintenance and automation scripts
```

### 当前分层原则

- `src/app/**`：只保留路由入口、layout、route handler，不承载业务实现。
- `src/features/admin/**`：管理后台面，固定为 `server/` + `schemas/`。
- `src/features/web/**`：终端用户面，当前承载 `auth/`、`chat/`，各自再分 `components/` 与 `server/`。
- `src/features/docs/**`：docs/blog 本地内容流水线与 docs 面逻辑，内容入口在 `server/content/**`。
- `src/shared/**`：只保留跨面的 UI primitives、hooks/utils/constants/types、以及确认跨面复用的 shell。
- `src/shared/services/payment/**`、`src/shared/services/settings/**`：继续作为跨面域服务保留在 shared。
- `src/shared/content/**`：仅保留跨面的 server-only 内容资产（如邮件模板），不再承载 docs/blog 本地内容流水线。

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Configure your environment variables
# Edit .env with your database URL, auth secrets, etc.

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Visit http://localhost:3000

### 品牌配置（推荐）

登录管理员后台后，在 `Admin -> Settings -> General -> Brand` 配置：

- `App Name`：用于站点标题、文档/SEO、邮件标题等
- `App URL (Origin)`：用于 canonical / sitemap / callback 等 URL 生成（必须是纯 origin）
- `Support Email`：用于法律页面与联系入口
- `NEXT_PUBLIC_APP_LOGO` / `NEXT_PUBLIC_APP_FAVICON` / `NEXT_PUBLIC_APP_PREVIEW_IMAGE`：用于品牌 Logo、favicon、社交分享预览图
- 也可在 `Admin -> Settings -> General -> Brand` 直接上传 Logo / Favicon / Preview Image（需先配置 Storage）
- 生产环境仍需设置 `NEXT_PUBLIC_APP_URL`（会被 Next.js 在 build 阶段内联）；推荐与 `App URL (Origin)` 保持一致

### Initialize RBAC (Optional)

```bash
# Create default roles and permissions
pnpm rbac:init

# Assign super_admin role to a user
pnpm rbac:init -- --admin-email=your@email.com
```

## Getting Started

Read `content/docs` to start your AI SaaS project.

## Documentation

### Engineering Guides

| Document                                  | Description                        |
| ----------------------------------------- | ---------------------------------- |
| [Auth Guide](docs/guides/auth.md)         | Authentication with Better Auth    |
| [Module Contract](docs/guides/module-contract.md) | Product module matrix and verification status |
| [RBAC Guide](docs/guides/rbac.md)         | Role-Based Access Control          |
| [Settings Guide](docs/guides/settings.md) | User and admin settings surfaces   |
| [Payment Guide](docs/guides/payment.md)   | Multi-provider payment integration |
| [Database Guide](docs/guides/database.md) | Drizzle ORM and migrations         |

### Code Quality

| Document                                           | Description                                              |
| -------------------------------------------------- | -------------------------------------------------------- |
| [Conventions Index](docs/CONVENTIONS.md)           | Entry point for repository conventions and code patterns |
| [Code Review](docs/CODE_REVIEW.md)                 | Full code review guide                                   |
| [Architecture Review](docs/ARCHITECTURE_REVIEW.md) | Architecture audit report                                |
| [Contributing](CONTRIBUTING.md)                    | Contribution guidelines                                  |

### Docs Site

- App info customization: `content/docs/customize-app-info.zh.mdx` (route: `/zh/docs/customize-app-info`)
- PR checklist: `content/docs/code-review-checklist.zh.mdx` (route: `/zh/docs/code-review-checklist`)
- Logging conventions: `content/docs/logging-conventions.zh.mdx` (route: `/zh/docs/logging-conventions`)

## Internationalization (i18n)

- Locale routing uses next-intl under `src/app/[locale]/**` + `src/request-proxy.ts`.
- Supported locales are defined in `src/config/locale/index.ts`.
- Message bundles live in `src/config/locale/messages/<locale>/**`; `en` is the complete base and other locales override partially (missing namespaces fall back to `en`).
- Server-side message loading is now route-scoped in `src/core/i18n/request.ts`: we infer the current pathname from middleware-injected request headers and only load the namespace set needed by that route.
- Client-side message loading is no longer injected from the `[locale]` root layout. Client trees that call `useTranslations()` are wrapped by local `ScopedIntlProvider` boundaries with explicit namespace lists.
- Docs site UI/content translation scope excludes the `demo/*` and `admin/*` namespaces (we only maintain them for `en/zh/zh-TW`).
- Fumadocs content now uses per-surface language scopes instead of the full app locale list:
  - `docs`: `en/zh`
  - `pages`: `en/zh/zh-TW`
  - `posts`: `en/zh`
- Unsupported docs locales now return `notFound()` instead of silently rendering English content.
- RTL locales (`ar`, `fa`, `he`, `ur`) set `<html dir="rtl">`.

## Deployment Notes

- Docker builds now use the default `.next` output (not `.next/standalone`) and start with `next start` (see `Dockerfile`).
- `wrangler.cloudflare.toml` and `open-next.config.ts` are the source of truth for the Cloudflare OpenNext build/deploy contract.
- Production `next build` is explicitly pinned to Webpack through [scripts/next-build.mjs](/Users/bin/Desktop/project/aooi/scripts/next-build.mjs) to avoid the current Turbopack/OpenNext Worker runtime incompatibility (`require_turbopack_runtime(...) is not a function`) on Cloudflare.
- `reactCompiler` is currently disabled in `next.config.mjs` because warm-build benchmarks on 2026-04-08 showed it materially hurt build time. Keep this as a single-path decision, not a long-lived dual config.
- TypeScript build scope is intentionally split: `tsconfig.json` covers app build inputs, while `tsconfig.test.json` covers tests and test-only type errors.
- Supported deployment modes are now single-origin only:
  - `DEPLOY_TARGET=vercel`: full-app on Vercel/Node
  - `DEPLOY_TARGET=cloudflare`: full-app on OpenNext/Cloudflare
- Cross-origin cookie auth topology is intentionally unsupported. `NEXT_PUBLIC_APP_URL` is the canonical app/auth origin; `AUTH_URL` and `BETTER_AUTH_URL` may only mirror that origin.
- Cloudflare helper commands:
  - `pnpm cf:build`
  - `pnpm cf:preview`
  - `pnpm test:local-auth-spike`
  - `pnpm test:cf-auth-spike`
  - `pnpm test:cf-oauth-spike`
  - `pnpm test:cf-app-smoke`
  - `pnpm test:creem-webhook-spike`
  - `pnpm test:r2-upload-spike`
  - `pnpm test:cf-preview-smoke`
  - `pnpm cf:deploy`
  - `pnpm cf:upload`
- `.github/workflows/cloudflare-preview-smoke.yaml` remains the fast repeated-request regression gate.
- `.github/workflows/dual-deploy-acceptance.yaml` now runs a `vercel|cloudflare` matrix, provisions a Postgres service container, and generates a temporary Cloudflare preview config for Worker-based checks.
- Single-origin deployment governance is documented in `docs/architecture/dual-deploy-governance.md`.
- Production Wrangler routing is now explicit: `workers_dev = false`, `preview_urls = false`, and the Worker is attached to the custom domain `mamamiya.pdfreprinting.net` via `[[routes]]`.
- `pnpm cf:preview` is a real full-app preview path: it reads DB-backed config via Hyperdrive and `wrangler.cloudflare.toml` `localConnectionString`, so config-driven pages follow your local `config` table state instead of hardcoded preview defaults.
- `pnpm test:local-auth-spike` boots a local Node surface and a local Cloudflare preview surface, then runs the shared dual-runtime auth harness against both. It now prefers reusing a healthy same-repo Node dev server from `.next/dev/lock`; otherwise it starts a clean local Node surface and still fails fast when Node/preview bootstrap exits early.
- `pnpm test:cf-preview-smoke` is the regression gate for the Workers DB hang fix. It checks `/api/config/get-configs`, `/sign-up`, and `/sign-in` twice in a row against Cloudflare preview so “first request works, second request hangs” gets caught automatically.
- `pnpm test:cf-preview-smoke` now prefers the real Wrangler `Ready on http://...` URL instead of assuming port `8787`, and only falls back to `CF_PREVIEW_URL` / `CF_PREVIEW_APP_URL` if log parsing fails.
- `pnpm test:cf-app-smoke` is the Cloudflare full-app smoke. It validates public entrypoints plus protected-route same-origin redirects back to `/sign-in`, and it treats any cross-origin redirect as a failure.
- `pnpm test:cf-app-smoke` is now read-only. It no longer upserts `app_url`, `general_docs_enabled`, or `general_ai_enabled`, and it does not require `DATABASE_URL` / `AUTH_SPIKE_DATABASE_URL` when reusing an existing preview server.
- `pnpm test:cf-auth-spike` runs the full Cloudflare preview auth spike on one local Worker surface: fresh sign-up, sign-in, protected session read, invalid-session redirect, and sign-out. It auto-generates a unique email alias per run and writes Markdown/JSON reports plus Playwright failure screenshots.
- `pnpm test:cf-oauth-spike` is a real Cloudflare preview OAuth acceptance command. It injects deterministic in-memory Google + GitHub auth config under `AUTH_SPIKE_OAUTH_MOCK=true`, drives the real `/sign-in` social buttons in the browser, mocks only provider authorize/token/userinfo, and exercises Better Auth callback, session establishment, same-origin callback-target access, denial handling, and sign-out on the Worker surface without mutating the local `config` table.
- `pnpm test:creem-webhook-spike` is the contract gate for Creem webhook signature verification and duplicate-renewal idempotency.
- `pnpm test:r2-upload-spike` is the contract gate for R2 upload success/failure semantics.
- Cloudflare config contract: local preview uses `[[hyperdrive]].localConnectionString`; real deploy/upload requires `[[hyperdrive]].id`, `DEPLOY_TARGET="cloudflare"`, `main=".open-next/worker.js"`, and a non-localhost pure-origin `NEXT_PUBLIC_APP_URL`.
- Platform-specific runtime code is restricted to `src/shared/lib/runtime/**`; see `docs/architecture/runtime-boundary.md`.

## Database Migrations (Required)

- Before starting the app in staging/production, apply migrations: `pnpm db:migrate`.
- If migrations are not applied, the server may fail fast on startup due to schema checks (e.g. missing `role.deleted_at`).

## Auth Secret (Production Required)

- In production you must set `BETTER_AUTH_SECRET` (preferred) or `AUTH_SECRET` to a strong random value.

## Auth Spike Feasibility Harness

- Command: `pnpm test:auth-spike`
- Required env vars:
  - `AUTH_SPIKE_VERCEL_URL`
  - `AUTH_SPIKE_CF_URL`
  - `AUTH_SPIKE_EMAIL`
  - `AUTH_SPIKE_PASSWORD`
  - `AUTH_SPIKE_CALLBACK_PATH`
- Optional env vars:
  - `AUTH_SPIKE_USER_NAME` (default: `Auth Spike User`)
- The command writes:
  - Markdown/JSON reports to `.gstack/projects/Larrybin-aooi/`
  - Failure screenshots to `output/playwright/auth-spike/`
- Harness rule: only `PASS` exits successfully; `BLOCKED` / `需要 adapter` / `需要替代路线` all exit non-zero.
- Each run generates surface-specific emails for `vercel` and `cloudflare`, so fresh sign-up stays real even when both deployments share one database.
- The report now records targeted preflight results before browser automation and uses `harnessStatus`, not gate wording.
- OAuth follow-up is intentionally split into `docs/architecture/cloudflare-oauth-auth-spike-plan.md`; keep OAuth out of the Phase 1 email/password harness.
- `pnpm test:cf-oauth-spike` is the dedicated OAuth harness for that follow-up plan. It is single-instance by design, injects mock OAuth provider config instead of writing the local DB, writes reports to `.gstack/projects/Larrybin-aooi/`, and writes failure screenshots to `output/playwright/cf-oauth-spike/`.

## Admin Settings (General)

- Path: `/admin/settings/general`
- Feature flags are stored in `config` table and exposed to the client via `publicSettingNames`.
- Defaults: all disabled.

### Keys

- `general_ai_enabled`: globally enables/disables the AI module (default: `false`). When disabled, AI pages and APIs return `notFound()` / `404` (in addition to hiding landing nav/buttons). After upgrading, enable it in `/admin/settings/general` if you want AI features.
- `general_locale_switcher_enabled`: controls language switcher rendering (Pricing + Sign in/up) (default: `false`)
- `general_social_links_enabled`: controls social icons rendering
- `general_social_links`: JSON array of social links

Example `general_social_links`:

```json
[
  {
    "title": "X",
    "icon": "RiTwitterXFill",
    "url": "https://x.com/your_handle",
    "target": "_blank",
    "enabled": true
  },
  {
    "title": "Email",
    "icon": "Mail",
    "url": "mailto:support@example.com",
    "target": "_self",
    "enabled": true
  }
]
```

## Feedback

Submit feedback via GitHub Issues.

## LICENSE

No license file is included in this repository. Add one if you plan to distribute the code.
