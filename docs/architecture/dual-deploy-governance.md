# Dual Deploy Governance

This repo treats Vercel + Cloudflare as one governed delivery surface, not two unrelated experiments.

Current governed status: `first-class`.

- Vercel is the first-class full-app origin.
- Cloudflare free is the first-class public-shell origin, with redirect fallback to the full-app origin for non-public surfaces.
- This status is backed by green deploy prerequisites plus the preview smoke, app smoke, auth spike, webhook, and upload gates.

## Status levels

### `first-class`

Required gates:

- `pnpm cf:build`
- `pnpm test:cf-preview-smoke`
- `pnpm test:local-auth-spike`
- `pnpm test:creem-webhook-spike`
- `pnpm test:r2-upload-spike`
- `pnpm test:cf-app-smoke`
- deploy prerequisites are satisfied (`pnpm cf:check:deploy`)

### `preview-only`

- Core build / contract gates are green
- But extended smoke is missing or failing
- Or deploy prerequisites are not closed

### `blocked`

- `pnpm cf:build` fails
- Or auth / payment / upload core gates fail
- Or the runtime boundary is bypassed
- Or deploy prerequisites are missing while Cloudflare is still claimed as formally deployable

## CI gates

### `Cloudflare Preview Smoke`

- Responsibility: repeated-request regression only
- Preview URL source: prefer Wrangler `Ready on http://...`; fall back to configured preview URL only if log parsing fails
- Checks:
  - `/api/config/get-configs`
  - `/sign-up`
  - `/sign-in`
- Each request must succeed twice in a row

### `Dual Deploy Acceptance`

- Uses a Postgres service container
- Runs migrations before acceptance gates
- Generates a temporary Wrangler config so preview uses the CI database instead of the tracked `wrangler.toml` local DSN
- Injects `CF_FALLBACK_ORIGIN` as a separate full-app origin and validates redirect fallback without calling that origin
- Runs:
  - `pnpm test`
  - `pnpm cf:build`
  - `pnpm test:creem-webhook-spike`
  - `pnpm test:r2-upload-spike`
  - `pnpm test:local-auth-spike`
  - `pnpm test:cf-app-smoke`

## Cloudflare app smoke scope

- Public:
  - `GET /`
  - `GET /sign-in`
  - `GET /sign-up`
  - `GET /api/config/get-configs`
  - `GET /sitemap.xml`
  - `GET /robots.txt`
- Redirect fallback:
  - `GET /docs`
  - `GET /ai-chatbot`
  - `GET /admin/settings/auth`
  - must return `307`
  - `Location` must point to `CF_FALLBACK_ORIGIN`

Cloudflare free deploy is now governed as a reduced public shell plus redirect fallback. Docs, chat, admin, billing, and other heavy surfaces are outside the first-class free Worker scope and must not be repacked into the Worker.

Production routing must also stay explicit in Wrangler:

- `workers_dev = false`
- `preview_urls = false`
- `[[routes]] pattern = "mamamiya.pdfreprinting.net" custom_domain = true`

## Version window

`next`, `@opennextjs/cloudflare`, and `wrangler` are managed as one version window.

- OpenNext may lag at most one supported Next minor
- Any upgrade of those three requires re-running every Cloudflare gate above

## Rollback rules

- If status drops to `blocked`, disable Cloudflare deploy jobs immediately
- `preview-only` may keep preview validation, but must not be described as formally deployable
- Any status downgrade must update:
  - this governance doc
  - the execution checklist
  - the capability matrix

## Next priority

`check:workers-compat` is not implemented yet. It is the next follow-up gate after the current runtime-boundary / smoke / CI closure.
