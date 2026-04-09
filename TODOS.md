# TODOS

## Review

## Deferred

### Defer new optional module families until the module contract is explicit

**What:** Do not add new optional module families before the product clearly labels what is `主线`、`可选`、`实验性`, and before each module has an explicit verification status.

**Why:** The repo already has wide capability coverage. The higher-leverage gap is product clarity and trust, not raw module count.

**Context:** The 2026-04-09 CEO review concluded that the next worthwhile expansion is productizing the module contract, not widening module breadth.

**Effort:** M
**Priority:** P1
**Depends on:** A concrete module matrix plus verification-status documentation

### Revisit provider-width expansion only after the module package is productized

**What:** Reconsider adding more analytics / affiliate / customer-service / payment providers only after the product surface clearly shows which modules are first-class and how well each path is validated.

**Why:** More provider choice adds config and test weight. Without a clear module contract, new breadth mostly increases confusion.

**Context:** Current provider breadth is already enough to represent extensibility. The blocker is packaging and trust expression, not lack of options.

**Effort:** M
**Priority:** P2
**Depends on:** Shipping the module matrix, verification labels, and enablement checklist

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
