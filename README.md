# Roller Rabbit

A production-ready AI SaaS template built with Next.js App Router, TypeScript, and modern tooling.

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

- PR checklist: `content/docs/code-review-checklist.zh.mdx` (route: `/zh/docs/code-review-checklist`)
- Logging conventions: `content/docs/logging-conventions.zh.mdx` (route: `/zh/docs/logging-conventions`)

## Internationalization (i18n)

- Locale routing uses next-intl under `src/app/[locale]/**` + `src/request-proxy.ts`.
- Supported locales are defined in `src/config/locale/index.ts`.
- Message bundles live in `src/config/locale/messages/<locale>/**`; `en` is the complete base and other locales override partially (missing namespaces fall back to `en`).
- Docs site UI/content translation scope excludes the `demo/*` and `admin/*` namespaces (we only maintain them for `en/zh/zh-TW`; other locales fall back to `en`).
- Docs/local markdown (fumadocs pages/posts/docs) currently ship for `en/zh`; other locales fall back to `en`.
- RTL locales (`ar`, `fa`, `he`, `ur`) set `<html dir="rtl">`.

## Deployment Notes

- Docker builds now use the default `.next` output (not `.next/standalone`) and start with `next start` (see `Dockerfile`).

## Database Migrations (Required)

- Before starting the app in staging/production, apply migrations: `pnpm db:migrate`.
- If migrations are not applied, the server may fail fast on startup due to schema checks (e.g. missing `role.deleted_at`).

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
