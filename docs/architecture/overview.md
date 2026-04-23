# Architecture Overview

This document is the current repository architecture baseline.
Executable architecture rules live in `src/testing/architecture-rules.ts`.
Documentation, dependency tests, and review checklists must describe that
manifest instead of inventing parallel allowlists.

## Layer Diagram

```text
src/app
  Route entrypoints only: pages, layouts, metadata, route handlers
      |
      v
src/surfaces
  Product/admin composition surfaces
      |
      v
src/domains
  Business semantics, invariants, application use cases, domain-owned repos
      |
      v
src/infra
  Platform context, runtime contracts, external adapters

src/shared
  Pure UI primitives, utilities, schemas, constants, cross-cutting types

src/config
  DB schema, env contract, locale messages, static product metadata
```

## Module Responsibilities

### `src/app`

- Owns Next.js routes, layouts, route handlers, metadata, redirects, and `notFound`.
- Converts HTTP/form/page transport models into application use-case inputs.
- Does not own business rules, repositories, provider selection, or cross-domain orchestration.
- `src/app/account/runtime-deps.ts` and `src/app/access-control/runtime-deps.ts` are the only stable app-only facades.
- These facades may be imported only from `src/app/**`; they are not a shared escape hatch and must not expand to other domains.

### `src/surfaces`

- Owns product surface composition that is not itself a domain.
- `src/surfaces/admin` composes admin pages, table factories, page setup, admin schemas, and settings module contract projections.
- Must not own repositories, provider implementations, payment/config interpretation, or domain invariants.

### `src/domains`

- Owns business semantics and invariants.
- Typical shape: `domain/`, `application/`, `infra/`, and optional `ui/` when UI is domain-specific.
- New domain admission requires an independent invariant, data boundary, or lifecycle. A UI-only feature, transport adapter, or admin aggregation is not enough to create a new domain.
- `domain/` owns business rules and reusable policies.
- `application/` owns use-case flow, technical fallback, degraded behavior, and external dependency absence handling. It is not a replacement for `shared/services`.
- `application/*.query.ts` and `application/*.view.ts` are read-only entrypoints for fetch/map/project work. They must not become business decision engines.
- Examples:
  - `account`: profile, API keys, member credits queries, auth UI ownership.
  - `billing`: pricing, checkout, payment notify/replay, subscriptions, credit semantics.
  - `chat`: chat creation/list/info/messages/stream use cases and chat UI.
  - `settings`: setting registry, validation, settings store, public config projection.
  - `access-control`: policy and pure checker.
  - `content`: docs/blog/page content query/view.

### `src/infra`

- `infra/platform`: platform entry capabilities such as Better Auth, i18n routing/request loading, request context, server logging, theme import contracts.
- `infra/adapters`: external implementation adapters such as DB, payment transports, email, storage, ads, analytics, affiliate, customer service.
- `infra/runtime`: env contract readers, runtime detection, Cloudflare/OpenNext runtime boundaries.

### `src/shared`

- Pure cross-cutting utilities, UI primitives, HTTP schemas, constants, and types.
- `shared/schemas/api/**` is for HTTP wire contracts only.
- `shared/lib/**` is allowlisted by `src/testing/architecture-rules.ts` and may only contain pure tools or transport helpers without business capability ownership.
- `shared` must not become a business capability layer.

### `src/config`

- DB schema and migrations.
- Locale message files.
- Product module metadata and env contract.

## Dependency Rules

```text
app/api, app/(admin) -> domains/*/application, surfaces/*, infra/platform|runtime, shared/*
public app composition -> shared/*, infra/platform, domains/*/application/*.query|*.view
surfaces/admin -> domains/*/application, shared/ui|schemas|types
domains/*/application -> own domain/infra, other domains only via *.query|*.view by default
domains/*/domain -> no app, no surfaces, no infra/platform, no infra/adapters, no HTTP schema, no Next.js API
infra/* -> no app/surfaces/domain application except settings *.query read projection
shared/* -> no business capability modules
```

Old architecture roots are removed: `src/core`, `src/features`, `src/shared/models`, and `src/shared/services`.

### App-Only Facade Matrix

- `src/app/**`
  - may import `src/surfaces/**`, `src/domains/*/application/**`, required `src/infra/platform/**`, required `src/infra/runtime/**`, and the two app-only facades
  - must not import `src/domains/*/infra/**` or `src/infra/adapters/**`
- `src/app/[locale]/(admin)/admin/**`
  - must be application-first; pages and actions may not talk to domain infra or adapters directly
- `src/app/[locale]/(landing)/settings/**`
  - member billing/settings entrypoints may not import billing infra or payment adapters directly
- `src/surfaces/admin/**`
  - may compose domain application and shared building blocks only
  - must not import app-only facades, domain infra, or infra adapters

## Anti-Regression Rules

`src/testing/architecture-rules.ts` is the machine-readable source of truth for:

- legacy forbidden imports and deleted architecture directories
- `shared/lib` allowed path patterns and forbidden semantic entry names
- platform imports allowed from domain application files
- public composition paths and query/view import boundaries
- application fan-out limit
- aggregation/orchestration budgets and required exception marker formats
- domain forbidden imports

The dependency tests import that manifest from `src/architecture-boundaries.test.ts`.
When a boundary changes, update the manifest first, then update documentation to
match the manifest. Do not maintain a second hidden allowlist in docs or review
notes.

### Application Fan-Out

Normal domain application files may depend on at most two external domain
application read entrypoints, and cross-domain imports must target `*.query.ts`
or `*.view.ts`. This is a structural budget, not proof that the semantics are
correct; code review still checks whether the dependency is a real read
relationship or hidden orchestration.

High fan-out read aggregation must be explicit:

```text
src/domains/<domain>/application/aggregation/<name>.aggregation.ts
```

Aggregation files are read-only, require
`architecture-exception: cross-domain-aggregation` plus `reason: ...`, cannot
import orchestration, cannot be called by another domain application, and are
budgeted by the manifest.

High fan-out write orchestration must be explicit:

```text
src/domains/<domain>/application/orchestration/<name>.orchestration.ts
```

Orchestration is only for unavoidable cross-domain transaction or compensation
flows. Files require `architecture-exception: cross-domain-orchestration`,
`reason: ...`, `owner: ...`, and `failure-compensation: ...`; they cannot import
another orchestration file or external domain infra/repository/provider modules.

## Policy Placement

Use this split when moving settings/config-driven behavior:

- `settings` stores fields and values.
- `application` controls process flow, technical fallback, degraded behavior, and missing dependency handling.
- `domain` owns business invariants, business rule decisions, and reusable business policy.

Settings values may be read by an application, but pricing, credits,
permission, plan, subscription, and provider enablement decisions must be
expressed through the owning domain functions. Domain functions should receive
explicit policy inputs, not a raw settings object.

## Config / Settings Boundary

Settings is not a business semantics owner.

- `domains/settings/application/settings-store.ts`: DB settings read/write, merge, patch, cache-tag invalidation.
- `domains/settings/application/settings-runtime.query.ts`: server-side typed runtime settings readers.
- `domains/settings/application/settings-runtime.builders.ts`: closed typed builders for `PublicUiConfig` and runtime subsets.
- Business domains interpret setting values. For example, billing owns provider enablement semantics through billing domain functions.

## Server Logging Boundary

Server logging lives in `src/infra/platform/logging/**`.

Standard structured log metadata:

- `requestId`
- `domain`
- `useCase`
- `operation`
- `route`
- `method`
- `actorUserId`

Use `getRequestLogger(req)` or `getRequestUseCaseLogger(req, ...)` at app/API
entrypoints. Use `createUseCaseLogger({ domain, useCase, operation, requestId })`
inside server-side use cases and platform/adapter code. Client/UI code may
display request IDs and format errors, but must not fabricate domain/use-case
logging tags.

## Request Flow

### API Request

```text
Request -> app/api route -> shared/schemas/api parse -> use-case input -> domain application -> response envelope
```

### Page Request

```text
Request -> app page/layout -> thin guard/context -> surface/domain view/query -> UI composition
```

### External Provider Flow

```text
app/api route -> domain application flow -> infra adapter transport/provider -> canonical domain result
```

## Enforced By

- `src/testing/architecture-rules.ts`
- `dependency-cruiser.cjs`
- `eslint.config.mjs`
- `src/architecture-boundaries.test.ts`
- Stage-specific contract tests under each domain/infra/surface

## Related Documents

- [Shared Layering](./shared-layering.md)
- [Runtime Boundary](./runtime-boundary.md)
- [Auth Guide](../guides/auth.md)
- [RBAC Guide](../guides/rbac.md)
- [Payment Guide](../guides/payment.md)
- [Database Guide](../guides/database.md)
- [Settings Guide](../guides/settings.md)
