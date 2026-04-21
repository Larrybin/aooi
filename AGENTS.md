# Repository Guidelines

## Project Structure & Module Organization

- `src/app`: Next.js routes, layouts, API handlers, and entrypoints.
- `src/domains`: business semantics, invariants, and application use cases.
- `src/infra`: platform, runtime, and external adapters such as auth, database, billing transports, and background services.
- `src/shared`: shared utilities, primitives, and cross-cutting types.
- `src/testing`: shared smoke/test contracts and test-only helpers. Production runtime code must not depend on this layer.
- `src/themes`, `content`, `public`: UI themes, marketing/docs content (MDX), and static assets.
- `scripts`: one-off maintenance and automation scripts (RBAC, migrations, etc.).

## Build, Test, and Development Commands

- Install dependencies: `pnpm install`.
- Local development: `pnpm dev` (http://localhost:3000).
- Production build: `pnpm build` (or `pnpm build:fast` for larger deployments).
- Run built app: `pnpm start`.
- Lint code: `pnpm lint`.
- Lint architecture graph: `pnpm lint:deps`.
- Format code: `pnpm format` / check only: `pnpm format:check`.
- Database workflows: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`.
- Cloudflare deployment helpers: `pnpm cf:check`, `pnpm cf:build`, `pnpm cf:typegen`, `pnpm cf:typegen:check`, `pnpm cf:deploy:state`, `pnpm cf:deploy:app`, `pnpm cf:deploy` (app alias), `pnpm test:cf-local-smoke`.

## Coding Style & Naming Conventions

- Language: TypeScript + React, Next.js App Router.
- Use Prettier and ESLint; do not bypass them in CI or local workflows.
- Prefer PascalCase for React components and types, camelCase for variables and functions, UPPER_SNAKE_CASE for environment variables.
- Follow Next.js file naming (`page.tsx`, `layout.tsx`, `route.ts`) and keep components small and single-responsibility.

## Testing Guidelines

- Use `pnpm test` as the default repository test gate; when adding tests, colocate them with features using `*.test.ts` / `*.test.tsx`.
- Keep `src/testing/**` limited to test-only contracts/helpers; do not let `src/**` or `cloudflare/**` production code import it.
- Keep tests fast and deterministic; prefer unit tests for domain logic in `src/domains` and lightweight integration tests for `src/app`.
- Treat generated directories such as `.open-next/`, `.next/`, `dist/`, `build/`, and `output/` as build artifacts only. Source files that must remain test-reachable may not top-level static `import` them; consume them only at explicit runtime boundaries, preferably via lazy `import()`.
- Treat `src/config/env-contract.ts` as the single env/secret contract source. Non-whitelisted runtime files must not read or propagate `process.env` directly.
- Ensure critical flows (auth, billing, database migrations) have at least basic coverage before major releases.

## Commit & Pull Request Guidelines

- Use clear, imperative commit messages; Conventional Commit style (e.g., `feat(auth): add email login`) is preferred.
- Keep PRs focused; describe **what**, **why**, and **how to test**.
- Link related issues or tasks and include screenshots for UI changes.
- When behavior, configuration, or APIs change, update `README.md`, `content` docs, and relevant config files to keep documentation in sync.
- GitHub Actions in this repo are pinned to full commit SHA with `# pinned from vX` comments; update them through Dependabot PRs plus manual review, and keep `dependency-review` / `cloudflare acceptance` configured as required checks in repo settings.
