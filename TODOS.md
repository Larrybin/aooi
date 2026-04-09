# TODOS

## Review

## Deferred

### Revisit provider alternatives only if the auth harness later returns adapter/replacement

**What:** Compare Better Auth continuation vs alternate provider/provider-path only after the stabilized harness yields a non-`PASS` result.

**Why:** Provider switching is expensive and answers a different question than “is Cloudflare email/password feasible here”.

**Current evidence:** The latest consolidated auth spike report is `PASS` on 2026-04-06, and the latest Cloudflare OAuth spike report is `PASS` on 2026-04-08.

**Context:** This review considered provider replacement strategically but kept it out of the current plan. That is still correct: the latest trustworthy outcomes are `PASS`, so this item should stay deferred until a future run reports `需要 adapter` or `需要替代路线`.

**Effort:** L
**Priority:** P2
**Depends on:** A future trustworthy non-`PASS` outcome from the auth spike harness

## Completed

### Tighten admin settings module entrypoints around the module contract

**Completed in:** `src/shared/services/settings/tab-names.ts`, `src/shared/services/settings/definitions/content.ts`, `src/shared/services/settings/definitions/ai.ts`, `src/config/product-modules/index.ts`, `src/app/[locale]/(admin)/admin/settings/[tab]/page.tsx`

- Added a dedicated `content` tab for Docs/Blog instead of hiding those module toggles inside `general`
- Moved the AI module enable toggle into the `ai` tab so `general` stays scoped to Core Shell concerns
- Switched the admin settings module contract header from a single-module card to per-module rows
- Made multi-module tabs explicit (`content`) and kept `email` as a pure supporting tab

### Productize the module contract before adding new optional module families

**Completed in:** `docs/guides/module-contract.md`, `src/config/product-modules/index.ts`, `src/app/[locale]/(admin)/admin/settings/[tab]/page.tsx`, `README.md`

- Landed an explicit `主线` / `可选` / `实验性` module model with per-module verification status
- Added a concrete module matrix and verification rules as the human-readable source of truth
- Added a code-level module registry as the single source of truth for tier / verification / settings-tab ownership
- Projected module tier, verification, and guide links into `admin/settings/<tab>` instead of leaving module status implicit
- Updated the product-facing README so the product package is described as `mainline + optional modules`, not raw module breadth

### Productize provider-width prerequisites before considering further provider expansion

**Completed in:** `docs/guides/module-contract.md`, `docs/guides/modules/auth.md`, `docs/guides/modules/billing.md`, `docs/guides/modules/ai.md`, `docs/guides/modules/storage.md`, `docs/guides/modules/docs-blog.md`, `docs/guides/modules/growth-support.md`, `docs/guides/settings.md`

- Shipped the module matrix and verification labels needed to express which modules are first-class and how much evidence each path has
- Added per-module configuration and minimum-verification guidance instead of leaving enablement expectations implicit
- Clarified in the settings guide that admin settings is a read-only projection of the module contract, not the truth source
- Provider-width expansion remains a product decision, but the original packaging/trust blocker is no longer the missing prerequisite

### Document how raw auth-spike conclusions map to governance actions

**Completed in:** `docs/architecture/dual-deploy-governance.md`, `src/config/product-modules/doc-links.test.ts`

- Added an explicit decision table for `PASS`, `需要 adapter`, `需要替代路线`, and `BLOCKED`
- Documented that governance must consume `rawConclusion`, not infer policy from exit-code wording
- Added a documentation test so the decision table cannot disappear silently

### Plan an OAuth-specific Cloudflare auth spike now that email/password is trustworthy

**Completed in:** `docs/architecture/cloudflare-oauth-auth-spike-plan.md`, `package.json`, `.gstack/projects/Larrybin-aooi/cf-oauth-spike-report.latest.md`

- Added a dedicated OAuth-only spike plan for Cloudflare preview
- Kept the OAuth harness separate from the Phase 1 email/password harness
- Landed a dedicated `pnpm test:cf-oauth-spike` command
- Covered callback success, provider denial, and state tampering for Google and GitHub
- The latest recorded Cloudflare OAuth spike outcome is `PASS` on 2026-04-08
