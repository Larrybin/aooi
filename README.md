# Roller Rabbit

Production-ready AI SaaS template built with Next.js App Router, TypeScript,
PostgreSQL, and a Cloudflare Workers production deploy contract.

## Developer Map

Start here:

- [Quick Start](#quick-start): run the app locally.
- [Project Structure](#project-structure): find the right layer before editing.
- [Common Commands](#common-commands): daily development commands.
- [Documentation](#documentation): deeper guides.

Core references:

- [Module Contract](docs/guides/module-contract.md): mainline vs optional modules.
- [Architecture Overview](docs/architecture/overview.md): current architecture baseline.
- [Deployment Guide](docs/guides/deployment.md): Cloudflare deployment and smoke flow.
- [Contributing](CONTRIBUTING.md): PR, style, and repository rules.

## Product Contract

Roller Rabbit treats the repo as:

- a mainline shell you can ship on day one
- a set of optional modules you enable later

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

The single source of truth for this split is
[docs/guides/module-contract.md](docs/guides/module-contract.md).

## Project Structure

```text
src/
├── app/           # Route-only: Next.js routes, layouts, route handlers
├── domains/       # Business semantics and application use cases
├── surfaces/      # Product/admin composition surfaces
├── infra/         # Platform/runtime/adapters
├── shared/        # Pure UI, utilities, schemas, and cross-cutting types
├── extensions/    # Third-party integrations
├── config/        # Configuration, DB schema, locale messages
├── testing/       # Shared smoke/test contracts and test-only helpers
└── themes/        # UI themes

docs/              # Engineering documentation
sites/             # Per-site identity, deploy, and content inputs
scripts/           # Maintenance and automation scripts
```

Layering rules:

- `src/app/**` keeps route entries, layouts, and route handlers thin.
- `src/domains/**` owns business semantics, invariants, and use cases.
- `src/surfaces/**` composes product/admin surfaces from domains.
- `src/infra/**` owns platform, runtime, and external adapters.
- `src/shared/**` stays generic: UI primitives, utilities, schemas, types.
- `src/testing/**` is test-only. Production code must not import it.

## Quick Start

Prerequisites:

- Node.js 20+
- pnpm
- PostgreSQL database

Run locally:

```bash
pnpm install
cp .env.example .env
```

Edit `.env` and set at least:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/aooi"
BETTER_AUTH_SECRET="replace-with-a-local-secret"
AUTH_SECRET="replace-with-the-same-local-secret"
```

Apply migrations and start the local site:

```bash
pnpm db:migrate
pnpm dev:local
```

Visit http://localhost:3000.

`pnpm dev:local` selects `sites/dev-local/site.config.json`, the local
development site. To run another site locally, use `SITE=<site-key> pnpm dev`.
Production-like, Cloudflare, smoke, build, and deploy commands must pass the
intended `SITE=<site-key>` explicitly.

## Common Commands

| Command                  | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `pnpm dev:local`         | Start local Next.js development server   |
| `pnpm test`              | Run unit and contract tests              |
| `pnpm lint`              | Run ESLint and env/process guards        |
| `pnpm arch:check`        | Run dependency graph and boundary checks |
| `pnpm format:check`      | Check Prettier formatting                |
| `pnpm db:generate`       | Generate Drizzle migrations              |
| `pnpm db:migrate`        | Apply database migrations                |
| `pnpm db:studio`         | Open Drizzle Studio                      |
| `SITE=<site> pnpm build` | Build the selected site                  |
| `SITE=<site> pnpm analyze` | Build with bundle analyzer reports     |

Cloudflare commands live in the
[Deployment Guide](docs/guides/deployment.md).

## Bundle 分析

使用分析构建（与现有 build 包装器一致）：

```bash
SITE=<site> pnpm analyze
```

例如本地基线可使用 `SITE=dev-local pnpm analyze`。

报告输出位置（Next Bundle Analyzer 默认目录）：

- `.next/analyze/client.html`
- `.next/analyze/edge.html`
- `.next/analyze/nodejs.html`

为便于基线对比，约定：

- 原始 analyzer 报告固定使用 `.next/analyze/`。
- 将关键指标按日期记录到本文档（或对应运维文档）“Bundle 分析”小节。
- 至少跟踪以下关键页面：首页（`/[locale]`）、登录（`/[locale]/sign-in`）、账单（`/[locale]/settings/billing`）。

### 初始基线（2026-04-28，SITE=dev-local）

- 初始 JS（root main files，总和）：`426,187 bytes`（≈ `416.2 KiB`）。
- 三个关键页面共享 chunk（交集，总和）：`534,522 bytes`（≈ `522.0 KiB`）。
- 主要路由 chunk（路由级 app chunks 总和）：

| 页面 | 路由级 chunk 总量 |
| --- | ---: |
| 首页 `(/[locale])` | `33,812 bytes` (≈ `33.0 KiB`) |
| 登录 `(/[locale]/sign-in)` | `41,819 bytes` (≈ `40.8 KiB`) |
| 账单 `(/[locale]/settings/billing)` | `35,939 bytes` (≈ `35.1 KiB`) |

## Site Configuration

Site identity is build-time input from `sites/<site>/site.config.json` and is
exposed to runtime code through the generated `@/site` module.

Current sites:

- `dev-local`: local development and tests
- `mamamiya`: production site

Important fields:

- `brand.appName`: site title, docs/SEO, and email title
- `brand.appUrl`: canonical URL, sitemap, and callback origin
- `brand.supportEmail`: legal pages and contact entry points
- `brand.logo`, `brand.favicon`, `brand.previewImage`: brand assets
- `capabilities`: site-level module availability

To add another site, follow
[docs/guides/add-site.md](docs/guides/add-site.md).

## Environment Contract

[src/config/env-contract.ts](src/config/env-contract.ts) is the single env and
secret allowlist source. Runtime files should read env through the approved
helpers instead of touching `process.env` directly.

`.env.example` is a local template with empty secret placeholders. The production
deploy target is Cloudflare; local `pnpm dev:local` still runs through Next.js
and does not require Wrangler.

## Documentation

Engineering guides:

| Document                                          | Description                                   |
| ------------------------------------------------- | --------------------------------------------- |
| [Auth Guide](docs/guides/auth.md)                 | Authentication with Better Auth               |
| [Add Site Runbook](docs/guides/add-site.md)       | Add a site instance                           |
| [Module Contract](docs/guides/module-contract.md) | Product module matrix and verification status |
| [Deployment Guide](docs/guides/deployment.md)     | Cloudflare deploy and smoke flow              |
| [Database Guide](docs/guides/database.md)         | Drizzle ORM and migrations                    |
| [Payment Guide](docs/guides/payment.md)           | Multi-provider payment integration            |
| [RBAC Guide](docs/guides/rbac.md)                 | Role-based access control                     |
| [Settings Guide](docs/guides/settings.md)         | User and admin settings surfaces              |

Quality references:

| Document                                               | Description                              |
| ------------------------------------------------------ | ---------------------------------------- |
| [Conventions Index](docs/CONVENTIONS.md)               | Repository conventions and code patterns |
| [Code Review](docs/CODE_REVIEW.md)                     | Full code review guide                   |
| [Architecture Overview](docs/architecture/overview.md) | Current architecture baseline            |
| [Architecture Review](docs/ARCHITECTURE_REVIEW.md)     | Historical architecture audit snapshot   |

Module guides:

- [Auth](docs/guides/modules/auth.md)
- [Billing](docs/guides/modules/billing.md)
- [Docs / Blog](docs/guides/modules/docs-blog.md)
- [AI](docs/guides/modules/ai.md)
- [Storage](docs/guides/modules/storage.md)
- [Growth Support](docs/guides/modules/growth-support.md)

## CI Guardrails

The main acceptance path runs:

```bash
pnpm lint
pnpm arch:check
pnpm test
pnpm cf:check
pnpm cf:build
```

GitHub Actions are pinned to full commit SHAs with `# pinned from vX` comments.
Keep `dependency-review` and `cloudflare acceptance` configured as required
checks in repository settings.

## Feedback

Submit feedback via GitHub Issues.

## License

No license file is included in this repository. Add one if you plan to distribute
the code.
