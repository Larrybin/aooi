# Single-Origin Deployment Governance

## Contract

- The template supports two first-class deployment targets:
  - `DEPLOY_TARGET=vercel`
  - `DEPLOY_TARGET=cloudflare`
- Each deployment chooses exactly one target.
- Public routes, auth routes, and protected routes must execute on the same origin.
- Cross-origin cookie auth topology is unsupported.

## Canonical Origin Rules

- `NEXT_PUBLIC_APP_URL` is the canonical app origin.
- `AUTH_URL` and `BETTER_AUTH_URL` may exist only as same-origin mirrors of `NEXT_PUBLIC_APP_URL`.
- In production, any request-derived auth origin that differs from `NEXT_PUBLIC_APP_URL` is a hard failure.
- In preview/local, request-derived auth origin may override the canonical origin only when it is `localhost` or `127.0.0.1`.

## Cloudflare Rules

- Cloudflare runs as a full-app OpenNext Worker.
- `wrangler.cloudflare.toml` is the only Cloudflare deployment config.
- `main` must point to `.open-next/worker.js`.
- `CF_FALLBACK_ORIGIN` is forbidden.
- Any protected route redirecting to another origin is a failure.

## Test Gates

- `pnpm test:local-auth-spike` validates the shared auth contract across local Node and Cloudflare preview.
- `pnpm test:cf-auth-spike` validates Cloudflare full-app email/password auth.
- `pnpm test:cf-oauth-spike` validates Cloudflare full-app OAuth, same-origin callback, denied/tamper failure paths, and sign-out.
- `pnpm test:cf-app-smoke` validates Cloudflare full-app public routes plus same-origin protected-route redirects.

## Fallback Inventory

The removed `originFallbackRoutes` inventory is preserved here for migration tracking:

### 1. auth/protected

- `/api/auth/**`
- `/sign-in`
- `/sign-up`
- `/settings/**`
- `/activity/**`
- `/admin/**`

### 2. core pages

- `/docs`
- `/blog/**`
- `/pricing`
- key landing pages previously routed through fallback

### 3. optional features

- `/chat/**`
- `/ai-*`
- payment, storage, and user utility APIs

Each group must pass smoke/auth validation before the next group is considered complete.
