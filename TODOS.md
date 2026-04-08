# TODOS

## Review

## Deferred

### Revisit provider alternatives only if Phase 1 later returns adapter/replacement

**What:** Compare Better Auth continuation vs alternate provider/provider-path only after the stabilized harness yields a non-PASS result.

**Why:** Provider switching is expensive and answers a different question than “is Cloudflare email/password feasible here”.

**Context:** This review considered provider replacement strategically but kept it out of the current plan. That is still correct: the latest harness outcome is `PASS`, so this item should stay deferred until a future run reports `需要 adapter` or `需要替代路线`.

**Effort:** L
**Priority:** P2
**Depends on:** A future trustworthy non-PASS outcome from the auth spike harness

## Completed

### Document how raw auth-spike conclusions map to governance actions

**Completed in:** `docs/architecture/dual-deploy-governance.md`

- Added an explicit decision table for `PASS`, `需要 adapter`, `需要替代路线`, and `BLOCKED`
- Documented governance transitions and required follow-up work
- Clarified that humans and automation must consume `rawConclusion`, not infer policy from exit-code wording

### Plan an OAuth-specific Cloudflare auth spike now that email/password is trustworthy

**Completed in:** `docs/architecture/cloudflare-oauth-auth-spike-plan.md`

- Added a dedicated OAuth-only spike plan for Cloudflare preview
- Split scope cleanly from the Phase 1 email/password harness
- Covered callback success, provider denial, and state tampering for Google and GitHub
