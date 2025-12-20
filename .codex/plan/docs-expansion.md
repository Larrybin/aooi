# Documentation Expansion Plan

## Overview

- **Goal**: Expand internal engineering documentation for secondary developers and team members
- **Language**: English only
- **Priority**: Auth > Payment > Others

## Target File Structure

```
docs/
├── guides/
│   ├── auth.md              # P0: Authentication guide
│   ├── rbac.md              # P0: RBAC usage guide
│   ├── payment.md           # P0: Payment integration guide
│   └── database.md          # P2: Database guide
├── api/
│   └── reference.md         # P2: API reference
├── architecture/
│   ├── overview.md          # P2: Architecture overview
│   └── shared-layering.md   # Existing
├── ARCHITECTURE_REVIEW.md   # Existing
├── CODE_REVIEW.md           # Existing
└── ROBUSTNESS_AUDIT.md      # Existing

root/
├── README.md                # P1: Expand existing
└── CONTRIBUTING.md          # P1: New file
```

## Execution Steps

### Phase 1: P0 - Auth & Payment (Priority)

#### Step 1.1: Create `docs/guides/auth.md`
- **Content**:
  - Overview: Better Auth integration with static/dynamic config separation
  - Architecture: `src/core/auth/` structure
  - Configuration: Social providers (Google, GitHub), email auth
  - API Routes: `/api/auth/[...all]` handler
  - Client usage: `src/core/auth/client.ts`
  - Environment variables required
- **Source files**: `src/core/auth/index.ts`, `src/core/auth/config.ts`, `src/core/auth/client.ts`

#### Step 1.2: Create `docs/guides/rbac.md`
- **Content**:
  - Overview: Role-Based Access Control system
  - Database schema: `role`, `permission`, `userRole`, `rolePermission`
  - Built-in roles: `super_admin`, `admin`, `editor`, `viewer`
  - Permission codes: wildcard matching (`admin.*`, `*`)
  - API: `createPermissionChecker()`, `hasPermission()`, `hasRole()`
  - Guard functions: `requireActionUser()`, `requireActionPermission()`
  - Scripts: `init-rbac.ts`, `assign-role.ts`
- **Source files**: `src/shared/services/rbac.ts`, `src/shared/lib/action/guard.ts`, `src/shared/constants/rbac-permissions.ts`

#### Step 1.3: Create `docs/guides/payment.md`
- **Content**:
  - Overview: Multi-provider payment system
  - Architecture: `PaymentManager` + `PaymentProvider` interface
  - Supported providers: Stripe, PayPal, Creem
  - Checkout flow: `/api/payment/checkout`
  - Webhook handling: `/api/payment/notify/[provider]`
  - Order lifecycle: status transitions
  - Configuration: provider-specific settings
- **Source files**: `src/extensions/payment/index.ts`, `src/extensions/payment/stripe.ts`, `src/app/api/payment/checkout/route.ts`, `src/app/api/payment/notify/[provider]/route.ts`

### Phase 2: P1 - README & Contributing

#### Step 2.1: Expand `README.md`
- Add architecture diagram (text-based)
- Add quick start guide for developers
- Add documentation index
- Keep existing content

#### Step 2.2: Create `CONTRIBUTING.md`
- Development setup
- Code style guidelines (reference AGENTS.md)
- PR workflow
- Testing guidelines
- Documentation standards

### Phase 3: P2 - Additional Docs

#### Step 3.1: Create `docs/guides/database.md`
- Drizzle ORM setup
- Schema location: `src/config/db/schema.ts`
- Migration workflow
- Multi-environment support (Hyperdrive, Serverless, Singleton)

#### Step 3.2: Create `docs/api/reference.md`
- API route index
- Common patterns: `withApi()`, error handling
- Request/Response schemas

#### Step 3.3: Create `docs/architecture/overview.md`
- Layer diagram
- Module responsibilities
- Dependency flow

## Expected Outcomes

- 8 new/updated documentation files
- Complete coverage of Auth, RBAC, Payment modules
- Clear onboarding path for secondary developers

## Notes

- All documentation in English
- Follow existing markdown style
- Reference actual file paths for traceability
