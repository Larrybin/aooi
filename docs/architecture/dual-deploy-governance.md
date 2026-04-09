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

## Raw Conclusion Governance

- Automation exit codes only express `harnessStatus`.
- Governance decisions must read `rawConclusion`.
- A non-zero exit code does not tell you whether the next action is adapter work, replacement work, or simply rerunning after setup repair.

| `rawConclusion` | Meaning | Governance action | Allowed / forbidden |
| --- | --- | --- | --- |
| `PASS` | The path is trustworthy within the tested scope. | Treat the path as currently governed and first-class for the tested capability. | Allowed: update product/docs language to reflect verified evidence. |
| `需要 adapter` | The path is viable, but the current contract still needs bounded normalization on the same implementation path. | Continue only with scoped contract-fix work on the current provider/runtime path. | Forbidden: do not start provider replacement; do not describe the path as fully verified. |
| `需要替代路线` | The current implementation path should not remain the governed default for that capability. | Stop adapter work and move to replacement-path or capability-reduction decision making. | Forbidden: do not keep presenting the current path as governed/validated by default. |
| `BLOCKED` | The run does not provide decision-quality evidence because setup or test trust is broken. | Fix environment, prerequisites, or harness trust first, then rerun. | Forbidden: do not make product or architecture conclusions from this run. |

Current semantic sources:

- `tests/smoke/auth-spike.shared.ts`
- `tests/smoke/oauth-spike.shared.ts`

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
