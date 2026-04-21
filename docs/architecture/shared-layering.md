# Shared Layering

`src/shared` is intentionally small. It is not a fallback for business code.
The executable allowlist for `src/shared/lib/**` lives in
`src/testing/architecture-rules.ts`; this document explains the rule, but the
manifest is the source of truth.

## Allowed Contents

- `src/shared/blocks/**`: cross-surface UI blocks.
- `src/shared/components/**`: UI primitives.
- `src/shared/contexts/**`: UI/application shell contexts.
- `src/shared/hooks/**`: generic client hooks.
- `src/shared/lib/**`: pure utilities and narrow transport/cross-cutting helpers that have no business capability ownership.
- `src/shared/schemas/api/**`: HTTP request/response wire contracts only.
- `src/shared/constants/**`: leaf constants.
- `src/shared/types/**`: cross-cutting types.
- `src/shared/content/**`: cross-surface server-only content assets such as email templates.

## Explicitly Disallowed

- Business repositories.
- Business orchestration services.
- Provider selection strategies.
- Settings/config interpretation.
- Domain entities or use-case DTOs.
- Public composition logic that belongs in `app/**`.
- Server logging; it belongs in `src/infra/platform/logging/**`.

`shared/lib` must not expose business entrypoints even if the file name does not
match a blacklist. The rule is semantic: shared utilities may normalize strings,
format dates, parse transport payloads, or provide API/action envelopes; they may
not decide payment availability, credits, RBAC, checkout, webhook, SEO,
provider enablement, auth session behavior, or landing visibility.

Old business roots `src/shared/models/**` and `src/shared/services/**` have been removed. New code must choose a real owner:

- Business semantics: `src/domains/<capability>/**`
- Admin composition: `src/surfaces/admin/**`
- Platform/runtime capability: `src/infra/platform/**` or `src/infra/runtime/**`
- External implementation: `src/infra/adapters/**`

## `shared/lib` Allowlist

`src/testing/architecture-rules.ts` allowlists the current `shared/lib` path
families. New files under `shared/lib` must fit one of these categories:

- API/action transport helpers such as parse, response, typed errors, rate limits, CSRF, and client fetch wrappers.
- Pure runtime utilities such as crypto helpers, request body helpers, upload primitives, date/time, JSON, UTF-8, hashing, cookies, and cache helpers.
- Pure URL/string helpers such as callback URL localization, storage public URL formatting, support email, or brand URL normalization.
- Generic client/UI helpers that have no domain semantics.

If a helper needs to know what a plan, provider, payment product, permission,
credit, content route, or setting means, it is not shared.

## HTTP Schemas

`src/shared/schemas/api/**` may contain:

- request body schemas
- response schemas
- route/search params schemas
- transport-level primitive validation

It must not contain:

- use-case inputs/outputs
- DB models
- domain entities
- business policies
- provider config parsers
- generic business DTOs

## UI Dependencies

Shared UI may depend on:

- `src/shared/**`
- `src/infra/platform/i18n/navigation`
- `src/infra/platform/auth/client`

Shared UI must not depend on:

- `src/infra/adapters/**`
- `src/domains/**`
- `src/surfaces/**`
- server-only modules

## Enforcement

The executable source of truth is:

- `src/testing/architecture-rules.ts`
- `eslint.config.mjs`
- `dependency-cruiser.cjs`
- `src/architecture-boundaries.test.ts`
