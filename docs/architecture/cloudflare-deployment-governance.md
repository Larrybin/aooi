# Cloudflare-Only Deployment Governance

## Contract

- The template supports exactly one production deployment target: `DEPLOY_TARGET=cloudflare`.
- Public routes, auth routes, and protected routes must execute on the same origin.
- Cross-origin cookie auth topology is unsupported.

## Canonical Origin Rules

- `site.brand.appUrl` is the canonical app origin.
- `AUTH_URL` and `BETTER_AUTH_URL` may exist only as same-origin mirrors of `site.brand.appUrl`.
- `NEXT_PUBLIC_APP_URL` is a generated deploy artifact derived from `site.brand.appUrl`.
- In production, any request-derived auth origin that differs from `site.brand.appUrl` is a hard failure.
- In preview/local, request-derived auth origin may override the canonical origin only when it is `localhost` or `127.0.0.1`.

## Cloudflare Rules

- Cloudflare runs as one private `state` Worker, one public router Worker, plus the canonical `public-web/auth/payment/member/chat/admin` private server Workers.
- `wrangler.cloudflare.toml` represents the router Worker.
- `cloudflare/wrangler.state.toml` represents the state Worker and is the only Durable Object owner.
- `cloudflare/wrangler.server-*.toml` represent the server Workers.
- Router-to-server dispatch must use Cloudflare version affinity.
- Production deploy authority belongs to a hand-operated local `wrangler` session authenticated through Wrangler OAuth on the operator machine.
- The operator must deploy the exact checked-out revision that passed local build and smoke gates; do not delegate release authority to branch-tip automation.
- GitHub Actions acceptance may inform the operator, but it must not be treated as the production deploy authority.
- Cloudflare preview is removed from the supported contract as a user-facing deploy command.
- `CF_FALLBACK_ORIGIN` is forbidden.
- Any protected route redirecting to another origin is a failure.
- `pnpm cf:build` is authoritative for size governance: it must pass `wrangler deploy --dry-run` for the state Worker and `wrangler versions upload --dry-run` for every app Worker, and every deployable gzip bundle must stay below `3 MiB`.
- Any accepted change to `src/config/db/schema.ts` must include committed files under `src/config/db/migrations/**`; otherwise release preparation must fail before deploy.
- Only the state Worker may define `[[migrations]]`.
- Router and all app workers must bind Durable Objects from `roller-rabbit-state`.
- State/app releases use an additive compatibility window: state-first changes may add fields or actions, but must not rename or redefine existing semantics in the same release.
- `pnpm cf:deploy:app` and `pnpm cf:deploy` are pure app release commands. They must not bootstrap a missing router/server topology.
- For brand-new or partially initialized production environments, the only valid release order is `pnpm cf:deploy:state` first and `pnpm cf:deploy` second.
- If app deploy detects a missing router/server deployment, it must fail fast and instruct the operator to run `pnpm cf:deploy:state` first.

## Test Gates

- `pnpm cf:check` validates the multi-worker config contract.
- `pnpm cf:build` validates OpenNext multi-bundle generation and hard-fails if any required bundle is missing or if state/app dry-run upload checks report a deployable gzip bundle `>= 3 MiB`.
- `pnpm test:cf-local-smoke` validates the canonical local Cloudflare runtime path through a generated temporary topology: the router and all server Workers start under one `wrangler dev` multi-config session, required `.open-next` artifacts are checked before boot, and the read-only smoke runs against the router origin.
- `pnpm test:cf-admin-settings-smoke` validates the smaller Cloudflare-only local acceptance chain for storage semantics: direct DB seeding, real `/api/storage/upload-image`, public config projection, and the explicit `STORAGE_PUBLIC_BASE_URL` missing-error path inside the same local Cloudflare runtime session.
- `pnpm test:cf-app-smoke` validates post-deploy production read-only smoke on the real app origin.
- Before production deploy, the operator must verify `pnpm exec wrangler whoami`, then run `pnpm cf:check`, `pnpm cf:build`, `pnpm cf:typegen:check`, and the relevant smoke gates locally.
- If schema changes are present, the operator must run production DB migration before `pnpm cf:deploy:state` or `pnpm cf:deploy`.
- GitHub-side deploy workflows are non-authoritative and must not replace the local Wrangler OAuth release path.
- Production release preparation may use `state_migrations_changed` as a migration-safety signal, but state deployment triggering must follow the broader `state_changed` surface.
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
