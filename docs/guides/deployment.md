# Deployment Guide

This repository uses Cloudflare Workers as the production deployment target.
Local development still uses the normal Next.js dev server.

## Deployment Contract

- Production deploy target: `DEPLOY_TARGET=cloudflare`.
- Production commands must pass the intended `SITE=<site-key>` explicitly.
- Site identity comes from `sites/<site>/site.config.json`.
- Deploy infrastructure input comes from `sites/<site>/deploy.settings.json`.
- Tracked Wrangler files are static templates. Generated site-specific configs
  are produced by the deploy scripts.
- Public, auth, and protected routes must run on the same canonical origin.
- Cross-origin cookie auth topology is unsupported.

The detailed governance rules live in
[docs/architecture/cloudflare-deployment-governance.md](../architecture/cloudflare-deployment-governance.md).

## Local Development

Use the local site with the Next.js dev server:

```bash
SITE=dev-local pnpm dev
```

This path does not require Wrangler login, R2 buckets, Hyperdrive, or local
multi-worker emulation.

## Required Production Resources

Provision these before the first Cloudflare deploy:

- PostgreSQL database reachable from Cloudflare Hyperdrive
- Cloudflare zone for the production domain
- Hyperdrive instance pointing at the PostgreSQL database
- R2 buckets for OpenNext cache and app storage when storage is enabled
- Worker route or custom domain for the app origin

`site.brand.appUrl` is the canonical app/auth origin. `AUTH_URL` and
`BETTER_AUTH_URL` may only mirror that same origin.

## Cloudflare Topology

Production uses one public router Worker, one state Worker, and the canonical
server Workers:

```text
router
state
public-web
auth
payment
member
chat
admin
```

The resolver derives worker names, routes, buckets, Hyperdrive id, Durable Object
owner, and runtime bindings from the selected site config and deploy settings.
Do not hardcode site-specific names in scripts or source code.

## Secrets And Runtime Vars

Set at least one shared auth secret for the Next server workers:

```bash
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
```

`AUTH_SECRET` is supported as the paired compatibility key for the same shared
secret. Optional modules require their own provider secrets only when enabled
such as Resend, Stripe, Creem, OpenRouter, Replicate, Fal, Kie, or PayPal.

Storage-related runtime bindings:

- `NEXT_INC_CACHE_R2_BUCKET`: shared OpenNext ISR/data cache bucket
- `APP_STORAGE_R2_BUCKET`: business upload bucket
- `IMAGES`: router-side Cloudflare Images binding
- `STORAGE_PUBLIC_BASE_URL`: public base URL for uploaded assets

Do not put real database DSNs or secrets into tracked Wrangler templates.

## Build And Deploy Commands

Run cheap checks first:

```bash
SITE=<site-key> pnpm cf:check
SITE=<site-key> pnpm cf:build
SITE=<site-key> pnpm cf:typegen
SITE=<site-key> pnpm cf:typegen:check
```

Deploy order for a new or partially initialized environment:

```bash
SITE=<site-key> pnpm cf:deploy:state
SITE=<site-key> pnpm cf:deploy
```

`pnpm cf:deploy` is an alias for `pnpm cf:deploy:app`. App deploys do not
bootstrap missing state/router/server topology.

## Migrations

Cloudflare Workers reads PostgreSQL through Hyperdrive at runtime, but schema
migrations still need direct database access:

```bash
DATABASE_URL="postgresql://user:password@db-host:5432/your_db" pnpm db:migrate
```

Any accepted change to `src/config/db/schema.ts` must include committed files
under `src/config/db/migrations/**`.

## Smoke Checks

Local Cloudflare diagnostics:

```bash
SITE=<site-key> pnpm test:cf-local-smoke
SITE=<site-key> pnpm test:cf-admin-settings-smoke
```

Production read-only smoke after deploy:

```bash
SITE=<site-key> pnpm test:cf-app-smoke
```

The production smoke validates public entry points, protected-route redirects
back to `/sign-in` on the same origin, config API, sitemap, and robots.

## First Deploy Checklist

Use this order for the first production deploy:

```bash
pnpm install
DATABASE_URL="postgresql://user:password@db-host:5432/your_db" pnpm db:migrate
SITE=<site-key> pnpm cf:check
SITE=<site-key> pnpm cf:build
SITE=<site-key> pnpm cf:typegen
SITE=<site-key> pnpm cf:typegen:check
SITE=<site-key> pnpm cf:deploy:state
SITE=<site-key> pnpm cf:deploy
SITE=<site-key> pnpm test:cf-app-smoke
```

After the smoke passes, open the production domain and manually verify sign-up,
sign-in, sign-out, and one protected route redirect.
