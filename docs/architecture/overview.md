# Architecture Overview

This document is the current repository architecture baseline.

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

### `src/surfaces`

- Owns product surface composition that is not itself a domain.
- `src/surfaces/admin` composes admin pages, table factories, page setup, admin schemas, and settings module contract projections.
- Must not own repositories, provider implementations, payment/config interpretation, or domain invariants.

### `src/domains`

- Owns business semantics and invariants.
- Typical shape: `domain/`, `application/`, `infra/`, and optional `ui/` when UI is domain-specific.
- Examples:
  - `account`: profile, API keys, member credits queries, auth UI ownership.
  - `billing`: pricing, checkout, payment notify/replay, subscriptions, credit semantics.
  - `chat`: chat creation/list/info/messages/stream use cases and chat UI.
  - `settings`: setting registry, validation, settings store, public config projection.
  - `access-control`: policy and pure checker.
  - `content`: docs/blog/page content query/view.

### `src/infra`

- `infra/platform`: platform entry capabilities such as Better Auth, i18n routing/request loading, request context, theme import contracts.
- `infra/adapters`: external implementation adapters such as DB, payment transports, email, storage, ads, analytics, affiliate, customer service.
- `infra/runtime`: env contract readers, runtime detection, Cloudflare/OpenNext runtime boundaries.

### `src/shared`

- Pure cross-cutting utilities, UI primitives, HTTP schemas, constants, and types.
- `shared/schemas/api/**` is for HTTP wire contracts only.
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
domains/*/domain -> no app, no surfaces, no infra/adapters, no HTTP schema, no Next.js API
infra/* -> no app/surfaces/domain application except settings *.query read projection
shared/* -> no business capability modules
```

Old architecture roots are removed: `src/core`, `src/features`, `src/shared/models`, and `src/shared/services`.

## Config / Settings Boundary

Settings is not a business semantics owner.

- `domains/settings/application/settings-store.ts`: DB settings read/write, merge, patch, cache-tag invalidation.
- `domains/settings/application/settings-runtime.query.ts`: read-only runtime settings projection.
- `domains/settings/application/public-config.view.ts`: public read projection for UI/SEO/theme.
- Business domains interpret setting values. For example, billing owns provider enablement semantics.

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
