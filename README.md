# Your App

A production-ready AI SaaS template built with Next.js App Router, TypeScript, and modern tooling.

## Architecture Overview

```
src/
├── app/           # Next.js routes, layouts, API handlers
├── core/          # Domain logic (auth, database, i18n, theme)
├── shared/        # Shared utilities, models, services, UI components
├── extensions/    # Third-party integrations (payment, AI, storage)
├── config/        # Configuration, DB schema, locale messages
└── themes/        # UI themes

docs/              # Engineering documentation
content/           # MDX content (docs, blog, legal pages)
scripts/           # Maintenance and automation scripts
```

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

### Initialize RBAC (Optional)

```bash
# Create default roles and permissions
npx tsx scripts/init-rbac.ts

# Assign super_admin role to a user
npx tsx scripts/init-rbac.ts --admin-email=your@email.com
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

- `general_theme_toggle_enabled`: controls all `ThemeToggler` usages (global)
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

submit your feedbacks on GitHub Issues

## LICENSE

No license file is included in this repository. Add one if you plan to distribute the code.
