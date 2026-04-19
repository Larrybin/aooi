# Cloudflare-Only Deployment Governance

## Contract

- The template supports exactly one production deployment target: `DEPLOY_TARGET=cloudflare`.
- Public routes, auth routes, and protected routes must execute on the same origin.
- Cross-origin cookie auth topology is unsupported.

## Canonical Origin Rules

- `NEXT_PUBLIC_APP_URL` is the canonical app origin.
- `AUTH_URL` and `BETTER_AUTH_URL` may exist only as same-origin mirrors of `NEXT_PUBLIC_APP_URL`.
- In production, any request-derived auth origin that differs from `NEXT_PUBLIC_APP_URL` is a hard failure.
- In preview/local, request-derived auth origin may override the canonical origin only when it is `localhost` or `127.0.0.1`.

## Cloudflare Rules

- Cloudflare runs as a router Worker plus the canonical `public-web/auth/payment/member/chat/admin` private server Workers.
- `wrangler.cloudflare.toml` represents the router Worker.
- `cloudflare/wrangler.server-*.toml` represent the server Workers.
- Router-to-server dispatch must use Cloudflare version affinity.
- `push main` release automation must deploy the exact accepted `head_sha`, not the default branch tip at deploy time.
- Acceptance must publish release metadata for Cloudflare auto-deploy; deploy automation must consume that metadata instead of recomputing release intent later.
- Historical acceptance reruns must not publish to production once their `head_sha` is no longer the current `main` head.
- Cloudflare preview is removed from the supported contract as a user-facing deploy command.
- `CF_FALLBACK_ORIGIN` is forbidden.
- Any protected route redirecting to another origin is a failure.
- `pnpm cf:build` is authoritative for size governance: it must pass `wrangler versions upload --dry-run`, and the deployable gzip size of every Worker must stay below `3 MiB`.
- Any accepted change to `src/config/db/schema.ts` must include committed files under `src/config/db/migrations/**`; otherwise release preparation must fail before deploy.
- Durable Object migration releases must stay migration-safe: `release_kind=migration` may include migration metadata, DO implementation/export changes, scripts, tests, and docs, but any router request dispatch change must ship through the normal rollout path.

## Test Gates

- `pnpm cf:check` validates the multi-worker config contract.
- `pnpm cf:build` validates OpenNext multi-bundle generation and hard-fails if any required bundle is missing or if `wrangler versions upload --dry-run` reports a deployable gzip bundle `>= 3 MiB`.
- `pnpm test:cf-local-smoke` validates the canonical local Cloudflare runtime path through a generated temporary topology: the router and all server Workers start under one `wrangler dev` multi-config session, required `.open-next` artifacts are checked before boot, and the read-only smoke runs against the router origin.
- `pnpm test:cf-admin-settings-smoke` validates the smaller Cloudflare-only local acceptance chain for admin/settings storage semantics: direct DB seeding, real `/api/storage/upload-image`, public config projection, and the explicit `storage_public_base_url` missing-error path inside the same local Cloudflare runtime session.
- `pnpm test:cf-app-smoke` validates post-deploy production read-only smoke on the real app origin.
- `cloudflare-production-deploy` may run only after `Cloudflare Deploy Acceptance` succeeds on `push main`; if release metadata reports schema changes, `cloudflare-production-migrate` must complete first.
- `cloudflare-production-migrate` remains the only manual production workflow; manual deploy by arbitrary SHA is intentionally unsupported.
- Public smoke package command names are stable. Internally, `scripts/smoke.mjs <scenario>` dispatches `cf-local`, `cf-app`, and `cf-admin-settings` to their concrete runner scripts.

## Raw Conclusion Governance

- Automation exit codes only express `harnessStatus`.
- Governance decisions must read `rawConclusion`.
- A non-zero exit code does not tell you whether the next action is adapter work, replacement work, or simply rerunning after setup repair.

| `rawConclusion` | Meaning                                                                                                         | Governance action                                                                       | Allowed / forbidden                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `PASS`          | The path is trustworthy within the tested scope.                                                                | Treat the path as currently governed and first-class for the tested capability.         | Allowed: update product/docs language to reflect verified evidence.                       |
| `需要 adapter`  | The path is viable, but the current contract still needs bounded normalization on the same implementation path. | Continue only with scoped contract-fix work on the current provider/runtime path.       | Forbidden: do not start provider replacement; do not describe the path as fully verified. |
| `需要替代路线`  | The current implementation path should not remain the governed default for that capability.                     | Stop adapter work and move to replacement-path or capability-reduction decision making. | Forbidden: do not keep presenting the current path as governed/validated by default.      |
| `BLOCKED`       | The run does not provide decision-quality evidence because setup or test trust is broken.                       | Fix environment, prerequisites, or harness trust first, then rerun.                     | Forbidden: do not make product or architecture conclusions from this run.                 |

Current semantic sources:

- `scripts/check-cloudflare-config.mjs`
- `scripts/run-cf-multi-build-check.mjs`
- `scripts/run-cf-admin-settings-smoke.mjs`
