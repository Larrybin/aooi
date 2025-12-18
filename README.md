# ShipAny Template Two

## Getting Started

read [ShipAny Document](https://shipany.ai/docs/quick-start) to start your AI SaaS project.

## Engineering Docs

- Full guide: `docs/CODE_REVIEW.md`
- PR checklist (docs site): `content/docs/code-review-checklist.zh.mdx` (route: `/zh/docs/code-review-checklist`)
- Logging conventions (docs site): `content/docs/logging-conventions.zh.mdx` (route: `/zh/docs/logging-conventions`)

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

- `general_built_with_enabled`: controls "Built with ❤️ ShipAny"
- `general_theme_toggle_enabled`: controls all `ThemeToggler` usages (global)
- `general_social_links_enabled`: controls social icons rendering
- `general_social_links`: JSON array of social links

Example `general_social_links`:

```json
[
  {
    "title": "X",
    "icon": "RiTwitterXFill",
    "url": "https://x.com/your-app",
    "target": "_blank",
    "enabled": true
  },
  {
    "title": "Email",
    "icon": "Mail",
    "url": "mailto:support@your-domain.com",
    "target": "_self",
    "enabled": true
  }
]
```

## Buy Templates

check [ShipAny Templates](https://shipany.ai/templates) to buy Business Templates.

## Feedback

submit your feedbacks on [Github Issues](https://github.com/shipanyai/shipany-template-two/issues)

## LICENSE

!!! Please do not publicly release ShipAny's Code. Illegal use will be prosecuted

[ShipAny LICENSE](./LICENSE)
