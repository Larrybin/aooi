# TODOs

## release:cf --trust-ci fast path

- **What:** Add an optional `pnpm release:cf --trust-ci` mode after the CI split is proven on `main`.
- **Why:** Strict `release:cf` currently re-runs lint, architecture checks, tests, Cloudflare config, and Cloudflare build after verifying the exact SHA already passed `Cloudflare Deploy Acceptance`. That is safe, but slow for routine releases.
- **Pros:** Keeps default release strict while giving the operator a faster path that still validates local release context.
- **Cons:** Adds release-script branching and must not weaken production deploy safety.
- **Context:** The fast path should still require clean `main`, `HEAD == origin/main`, a successful exact-SHA `Cloudflare Deploy Acceptance`, `check-release-inputs`, `cf:check`, `cf:build`, production `db:migrate`, state deploy, app deploy, and production smoke. Only lint, `arch:check`, and `pnpm test` should be skipped.
- **Depends on / blocked by:** Wait until the split `Cloudflare Deploy Acceptance` workflow is stable and branch protection requires the summary check.
