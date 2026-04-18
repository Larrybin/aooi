# Repository Guidelines

## Project Structure & Module Organization

- `src/app`: Next.js routes, layouts, API handlers, and entrypoints.
- `src/core`: domain logic such as auth, database, billing, and background services.
- `src/shared`: shared utilities, primitives, and cross-cutting types.
- `src/themes`, `content`, `public`: UI themes, marketing/docs content (MDX), and static assets.
- `scripts`: one-off maintenance and automation scripts (RBAC, migrations, etc.).

## Build, Test, and Development Commands

- Install dependencies: `pnpm install`.
- Local development: `pnpm dev` (http://localhost:3000).
- Production build: `pnpm build` (or `pnpm build:fast` for larger deployments).
- Run built app: `pnpm start`.
- Lint code: `pnpm lint`.
- Format code: `pnpm format` / check only: `pnpm format:check`.
- Database workflows: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`.
- Cloudflare deployment helpers: `pnpm cf:check`, `pnpm cf:build`, `pnpm cf:deploy`, `pnpm test:cf-local-smoke`.

## Coding Style & Naming Conventions

- Language: TypeScript + React, Next.js App Router.
- Use Prettier and ESLint; do not bypass them in CI or local workflows.
- Prefer PascalCase for React components and types, camelCase for variables and functions, UPPER_SNAKE_CASE for environment variables.
- Follow Next.js file naming (`page.tsx`, `layout.tsx`, `route.ts`) and keep components small and single-responsibility.

## Testing Guidelines

- Use `pnpm test` as the default repository test gate; when adding tests, colocate them with features using `*.test.ts` / `*.test.tsx`.
- Keep tests fast and deterministic; prefer unit tests for core logic in `src/core` and lightweight integration tests for `src/app`.
- Treat generated directories such as `.open-next/`, `.next/`, `dist/`, `build/`, and `output/` as build artifacts only. Source files that must remain test-reachable may not top-level static `import` them; consume them only at explicit runtime boundaries, preferably via lazy `import()`.
- Ensure critical flows (auth, billing, database migrations) have at least basic coverage before major releases.

## Commit & Pull Request Guidelines

- Use clear, imperative commit messages; Conventional Commit style (e.g., `feat(auth): add email login`) is preferred.
- Keep PRs focused; describe **what**, **why**, and **how to test**.
- Link related issues or tasks and include screenshots for UI changes.
- When behavior, configuration, or APIs change, update `README.md`, `content` docs, and relevant config files to keep documentation in sync.
