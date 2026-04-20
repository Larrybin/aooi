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
├── core/          # Foundation: auth, database, i18n, payment, docs source, theme
├── shared/        # Cross-surface primitives, services, utilities, types
├── extensions/    # Third-party integrations (AI, storage, etc.)
├── config/        # Configuration, DB schema, locale messages
├── testing/       # Shared smoke/test contracts and test-only helpers
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
- `src/core/payment/**`：支付唯一实现根，固定分为 `domain / providers / flows / webhooks`；app 层只做 HTTP 入口与依赖装配。
- `src/shared/**`：只保留跨面的 UI primitives、hooks/utils/constants/types、以及确认跨面复用的 shell。
- `src/shared/services/settings/**`：继续作为跨面域服务保留在 shared。
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

| Document                                          | Description                                   |
| ------------------------------------------------- | --------------------------------------------- |
| [Auth Guide](docs/guides/auth.md)                 | Authentication with Better Auth               |
| [Module Contract](docs/guides/module-contract.md) | Product module matrix and verification status |
| [RBAC Guide](docs/guides/rbac.md)                 | Role-Based Access Control                     |
| [Settings Guide](docs/guides/settings.md)         | User and admin settings surfaces              |
| [Payment Guide](docs/guides/payment.md)           | Multi-provider payment integration            |
| [Database Guide](docs/guides/database.md)         | Drizzle ORM and migrations                    |

### Smoke Harness

- `scripts/lib/harness/runtime.mjs`：统一管理 env 校验、子进程生命周期、ready/exit 行为和失败日志采样。
- `scripts/lib/harness/scenario.mjs`：只承载 smoke phase 编排与 cleanup 语义。
- `scripts/lib/harness/reporter.mjs`：统一 JSON/Markdown/latest report 输出和 harness exit code 规则。
- 公共 package 命令名保持稳定；内部统一由 `scripts/smoke.mjs <scenario>` 调度到底层 runner。当前场景包括 `auth-spike`、`cf-app`、`cf-local`、`cf-admin-settings`。
- 底层 runner（如 `scripts/run-auth-spike.mjs`、`scripts/run-cf-app-smoke.mjs`、`scripts/run-cf-local-smoke.mjs`、`scripts/run-cf-admin-settings-smoke.mjs`）继续承载具体断言，供测试直接导入。
- `src/testing/**` 是测试支持层，不是通用生产工具层。这里只允许放测试共享合同、smoke/shared 断言 helper、测试专用纯函数工具；`src/**` 与 `cloudflare/**` 生产代码不得依赖它。

### Code Quality

| Document                                           | Description                                              |
| -------------------------------------------------- | -------------------------------------------------------- |
| [Conventions Index](docs/CONVENTIONS.md)           | Entry point for repository conventions and code patterns |
| [Code Review](docs/CODE_REVIEW.md)                 | Full code review guide                                   |
| [Architecture Review](docs/ARCHITECTURE_REVIEW.md) | Architecture audit report                                |
| [Contributing](CONTRIBUTING.md)                    | Contribution guidelines                                  |

### CI Guardrails

- `pnpm lint:deps` 是仓库正式门禁，使用 `dependency-cruiser` 校验目录边界、`src/testing/**` 依赖方向和全仓循环依赖。
- `.github/workflows/dependency-review.yaml` 会在 `pull_request -> main` 运行 `dependency-review`，当前只拦截新增 `high/critical` 依赖漏洞。
- `.github/workflows/cloudflare-acceptance.yaml` 的顺序固定为：`pnpm lint` -> `pnpm lint:deps` -> `pnpm test` -> `pnpm cf:check` -> `pnpm cf:build` -> Cloudflare smoke。
- 所有 marketplace actions 都固定到完整 commit SHA，并在 `uses:` 旁保留 `# pinned from vX` 注释；`.github/dependabot.yml` 负责按周提出 `github-actions` 与 `npm` 更新 PR，但默认不自动合并。
- GitHub 平台侧仍需手工开启 `secret scanning`、`push protection`，并把 `dependency-review` 与 `cloudflare acceptance` 设为 required checks。

### Env Contract

- `src/config/env-contract.ts` 是仓库唯一的 env/secret allowlist 来源，统一维护 `PUBLIC_ENV_KEYS`、`SERVER_RUNTIME_ENV_KEYS`、`CLOUDFLARE_SECRET_ENV_KEYS`、`DEV_VARS_ALLOWED_KEYS`。
- `src/config/public-env.ts`、`src/shared/lib/runtime/env.server.ts`、`src/config/server-auth-base-url.ts`、`src/config/load-dotenv.ts` 是允许直接触碰环境变量的边界模块；其余 `src/**`、`cloudflare/**` 运行时代码必须走 helper。
- `pnpm lint` 会拦截非白名单文件中的 `process.env` 读取或传播；仓库 contract test 还会扫描未登记的 `NEXT_PUBLIC_*` 和裸 `process.env` 痕迹。
- `.env.example` 中的 secret 只能保留空占位；Cloudflare secrets 文件与临时 `.dev.vars` 生成逻辑只能输出 allowlist 内键。

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
- Generated directories such as `.open-next/`, `.next/`, `dist/`, `build/`, and `output/` are build artifacts, not source dependencies. Test-reachable source files must not top-level static `import` them; only explicit runtime boundaries may consume them, and runtime-only OpenNext helpers should be loaded lazily with `import()`.
- `DEPLOY_TARGET=cloudflare` is the only supported production deploy contract.
- Cross-origin cookie auth topology is intentionally unsupported. `NEXT_PUBLIC_APP_URL` is the canonical app/auth origin; `AUTH_URL` and `BETTER_AUTH_URL` may only mirror that origin.
- Cloudflare now targets one router Worker plus six canonical server Workers: `public-web`, `auth`, `payment`, `member`, `chat`, `admin`. The router lives in [wrangler.cloudflare.toml](/Users/bin/Desktop/project/aooi/wrangler.cloudflare.toml); each server Worker has its own `cloudflare/wrangler.server-*.toml`.
- OpenNext persistent cache is Cloudflare-only: router and all server Workers share `NEXT_INC_CACHE_R2_BUCKET`, tag cache + queue run on Durable Objects, and router image optimization is enabled through `IMAGES`.
- Business uploads are Cloudflare-only: runtime writes directly to `APP_STORAGE_R2_BUCKET`, and public asset URLs are derived from `storage_public_base_url + objectKey`.
- `pnpm test:cf-admin-settings-smoke` is intentionally smaller than the browser-heavy admin write path. It seeds brand/storage settings directly in Postgres, uploads through the real Cloudflare runtime API inside one local Cloudflare runtime session, and then verifies public config projection plus the explicit missing-`storage_public_base_url` failure path.
- Cloudflare preview and `cf:upload` are intentionally removed as user-facing deploy commands. Local runtime verification is `pnpm test:cf-local-smoke`; production verification is `pnpm test:cf-app-smoke` against the real app origin after deploy.
- Current Cloudflare build status is `READY`: on April 15, 2026, `pnpm cf:build` verified the canonical state/app topology under the authoritative dry-run upload gate. The state worker uses `wrangler deploy --dry-run`; router and server workers use `wrangler versions upload --dry-run`.
- Cloudflare helper commands:
- `pnpm cf:check`
- `pnpm cf:build`
- `pnpm cf:typegen`
- `pnpm cf:typegen:check`
- `pnpm test:cf-local-smoke`
- `pnpm test:cf-admin-settings-smoke`
- `pnpm test:cf-app-smoke`
- `pnpm cf:deploy:state`
- `pnpm cf:deploy:app`
- `pnpm cf:deploy` (`pnpm cf:deploy:app` 的别名)
- Smoke runner scenarios:
  - `pnpm test:cf-local-smoke` -> `scripts/smoke.mjs cf-local`
  - `pnpm test:cf-app-smoke` -> `scripts/smoke.mjs cf-app`
  - `pnpm test:cf-admin-settings-smoke` -> `pnpm cf:build && scripts/smoke.mjs cf-admin-settings`
- The only authoritative production deploy channel is a hand-operated local `wrangler` session authenticated through Wrangler OAuth on the operator machine.
- `.github/workflows/cloudflare-acceptance.yaml` remains a CI acceptance gate, but it is not a production deploy authority.
- Any GitHub-side deploy or migrate workflow that still exists in the repo is informational or fallback-only; release authority stays with the local operator session.
- Cloudflare-only deployment governance is documented in `docs/architecture/cloudflare-deployment-governance.md`.
- Production Wrangler routing is now explicit: `workers_dev = false`, `preview_urls = false`, and the router Worker is attached to the custom domain `mamamiya.pdfreprinting.net` via `[[routes]]`.
- `pnpm test:cf-app-smoke` is the Cloudflare full-app smoke. It validates public entrypoints plus protected-route same-origin redirects back to `/sign-in`, and it treats any cross-origin redirect as a failure.
- `pnpm test:cf-app-smoke` is now read-only. It no longer upserts `app_url`, `general_docs_enabled`, or `general_ai_enabled`, and it does not require `DATABASE_URL` / `AUTH_SPIKE_DATABASE_URL` when reusing an existing smoke target.
- `pnpm test:creem-webhook-spike` is the contract gate for Creem webhook signature verification and duplicate-renewal idempotency.
- `pnpm test:r2-upload-spike` is the contract gate for R2 upload success/failure semantics.
- Cloudflare config contract: router deploy uses `wrangler.cloudflare.toml`; server deploys use `cloudflare/wrangler.server-*.toml`; all Workers share the same `compatibility_date`, `compatibility_flags`, Hyperdrive binding, and canonical `NEXT_PUBLIC_APP_URL`.
- Platform-specific runtime code is restricted to `src/shared/lib/runtime/**`; see `docs/architecture/runtime-boundary.md`.
- The operator workstation must have a valid Wrangler OAuth login with Cloudflare Workers write access; verify with `pnpm exec wrangler whoami` before production deploy.
- Any change to `src/config/db/schema.ts` must ship with committed files under `src/config/db/migrations/**`; acceptance must fail before deploy if they are missing.

### Cloudflare Deployment Runbook

Use this when you want to ship the full app to Cloudflare Workers through OpenNext.
The supported contract is now multi-worker only: one router Worker plus the canonical `public-web/auth/payment/member/chat/admin` server Workers on one canonical origin.
Cloudflare preview is removed from the deploy contract. `pnpm cf:build` is the hard local build gate that dry-runs real Worker uploads, `pnpm test:cf-local-smoke` boots the full split-worker topology through a single local `wrangler dev` multi-config session, and the only authoritative production release path is an authenticated local Wrangler OAuth session running `pnpm cf:deploy:state` first when Durable Object ownership changes, then `pnpm cf:deploy`, followed by `pnpm test:cf-app-smoke`.

#### 1. Provision the external resources first

You need these before touching the deploy command:

- A PostgreSQL database reachable from Cloudflare Hyperdrive
- A Cloudflare zone with the production domain already managed in Cloudflare DNS
- One Hyperdrive instance pointing at that PostgreSQL database
- One Worker route or custom domain for the app origin

This repo assumes the production app origin and auth origin are the same.
If you were planning to put auth on another domain, stop. That topology is intentionally unsupported.

#### 2. Update router + server Wrangler configs

Edit [wrangler.cloudflare.toml](/Users/bin/Desktop/project/aooi/wrangler.cloudflare.toml), [cloudflare/wrangler.state.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.state.toml), and the relevant `cloudflare/wrangler.server-*.toml` files together:

```toml
name = "your-router-worker-name"
main = "cloudflare/workers/router.ts"
compatibility_date = "2025-03-01"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]
workers_dev = false
preview_urls = false

[[routes]]
pattern = "app.example.com"
custom_domain = true

[assets]
binding = "ASSETS"
directory = ".open-next/assets"

[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "your-router-worker-name"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-id"
localConnectionString = ""

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://app.example.com"
NEXT_PUBLIC_APP_NAME = "Your App"
NEXT_PUBLIC_THEME = "default"
DATABASE_PROVIDER = "postgresql"
DB_SINGLETON_ENABLED = "true"
```

Rules that matter:

- `NEXT_PUBLIC_APP_URL` must be a pure origin and must match the route exactly
- `service` under `WORKER_SELF_REFERENCE` must match `name`
- `cloudflare/wrangler.state.toml` is the only template allowed to keep `[[migrations]]`
- each server worker needs its own `cloudflare/wrangler.server-*.toml` with no public `[[routes]]`
- the canonical server worker set is `public-web/auth/payment/member/chat/admin`; keep names, bindings, and split ownership aligned with `src/shared/config/cloudflare-worker-splits.ts`
- router services and server worker names must stay in sync with `src/shared/config/cloudflare-worker-splits.ts`
- router and all app workers must point Durable Object bindings at `roller-rabbit-state`
- tracked Wrangler templates must keep `localConnectionString = ""`; local and CI DSNs only enter generated temporary configs
- Do not add `CF_FALLBACK_ORIGIN`; single-origin Cloudflare mode forbids it

#### 3. Set production secrets in Cloudflare

At minimum, set the auth signing secret:

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.cloudflare.toml
```

Recommended:

- In multi-worker Cloudflare mode, set the same `BETTER_AUTH_SECRET` on the router worker and every `cloudflare/wrangler.server-*.toml` worker config
- Use `BETTER_AUTH_SECRET` and leave `AUTH_SECRET` unset unless you have a compatibility reason

#### 4. Local runtime and deploy wiring

Do not put a real local PostgreSQL DSN into tracked Wrangler files.

- Local smoke uses an explicit `DATABASE_URL` plus `pnpm test:cf-local-smoke`; tracked `.dev.vars` must stay on the non-DB allowlist and cannot carry PostgreSQL DSNs
- Local manual deploy uses temporary Wrangler configs or `--secrets-file`; tracked templates stay secret-free
- If you still run CI smoke around this path, keep the same temporary-config discipline there as well
- Generate the secret with `openssl rand -base64 32`

Optional feature secrets such as Resend, Stripe, Creem, or storage credentials are only required if you actually enable those modules.

Storage-specific Cloudflare bindings/config:

- `NEXT_INC_CACHE_R2_BUCKET`: shared OpenNext ISR/data cache bucket across router + all server Workers
- `APP_STORAGE_R2_BUCKET`: business upload bucket for brand assets and `/api/storage/upload-image`
- `IMAGES`: router-side Cloudflare Images binding for optimized `next/image`
- `storage_public_base_url`: the only runtime setting used to derive public asset URLs

#### 4. Run database migrations against production

Cloudflare Workers reads PostgreSQL through Hyperdrive at runtime, but schema migrations still need direct database access from your machine or CI job:

```bash
DATABASE_URL="postgresql://user:password@db-host:5432/your_db" pnpm db:migrate
```

Run this before the first production deploy and before any later deploy that includes schema changes.

Deploy authority and migration discipline:

- Production deploy authority is the local operator machine authenticated with Wrangler OAuth
- Run `pnpm exec wrangler whoami` before deploy and confirm the expected account plus Workers write scopes
- If the release changes `src/config/db/schema.ts`, run `pnpm db:migrate` against production before `pnpm cf:deploy:state` or `pnpm cf:deploy`
- If you keep GitHub workflows around, do not treat them as the release authority or as the canonical source of deploy intent

#### 5. Run the build gates

Start with the cheap checks:

```bash
pnpm cf:check
pnpm cf:build
```

`pnpm cf:build` must keep every deployable Worker bundle under the Cloudflare 3 MiB gzip limit as verified by state/app dry-run upload checks. If it fails, do not deploy.

#### 6. Deploy

The authoritative production app release command is:

```bash
pnpm cf:deploy
```

Before running it, confirm your local Wrangler OAuth session with:

```bash
pnpm exec wrangler whoami
```

Then run:

```bash
pnpm cf:deploy:state
pnpm cf:deploy
```

`pnpm cf:deploy:state` always uses `wrangler deploy` and is the only command allowed to apply Durable Object migrations.
`pnpm cf:deploy` remains a convenience alias for `pnpm cf:deploy:app`.
`pnpm cf:deploy:app` is a pure app release command. It does not bootstrap router/server workers, and it fails fast if any app worker deployment is missing.
For a brand-new or partially initialized production environment, the required order is always `pnpm cf:deploy:state` first and `pnpm cf:deploy` second.
`pnpm test:cf-app-smoke` belongs after the full state-plus-app release sequence, not after a standalone state deploy.
This local authenticated path is the release authority. Do not treat GitHub Actions automation as the canonical production deploy mechanism.

#### 7. Verify production immediately

Run these checks against the real domain right after deploy:

```bash
curl -I https://app.example.com
curl -I https://app.example.com/sign-in
curl -I https://app.example.com/sign-up
curl https://app.example.com/api/config/get-configs
curl -I https://app.example.com/robots.txt
curl -I https://app.example.com/sitemap.xml
```

Then manually verify:

- Sign-up
- Sign-in
- Sign-out
- One protected route redirecting back to `/sign-in` on the same origin

If a protected route redirects to another host, treat that as a broken deployment, not a harmless warning.

#### 8. First deploy checklist

Use this exact order the first time:

```bash
pnpm install
DATABASE_URL="postgresql://user:password@db-host:5432/your_db" pnpm db:migrate
pnpm cf:check
pnpm cf:build
pnpm cf:typegen
pnpm cf:typegen:check
pnpm cf:deploy:state
pnpm cf:deploy
```

If that succeeds, open the production domain and complete one real auth flow before calling the release done.

## Database Migrations (Required)

- Before starting the app in staging/production, apply migrations: `pnpm db:migrate`.
- If migrations are not applied, the first database-backed request will fail with the schema guard until `pnpm db:migrate` is applied.

## Auth Secret (Production Required)

- In production you must set `BETTER_AUTH_SECRET` (preferred) or `AUTH_SECRET` to a strong random value.

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
