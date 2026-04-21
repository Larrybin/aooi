# Shared Layering

`src/shared` is intentionally small. It is not a fallback for business code.

## Allowed Contents

- `src/shared/blocks/**`: cross-surface UI blocks.
- `src/shared/components/**`: UI primitives.
- `src/shared/contexts/**`: UI/application shell contexts.
- `src/shared/hooks/**`: generic client hooks.
- `src/shared/lib/**`: pure utilities and narrow cross-cutting helpers.
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

Old business roots `src/shared/models/**` and `src/shared/services/**` have been removed. New code must choose a real owner:

- Business semantics: `src/domains/<capability>/**`
- Admin composition: `src/surfaces/admin/**`
- Platform/runtime capability: `src/infra/platform/**` or `src/infra/runtime/**`
- External implementation: `src/infra/adapters/**`

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

- `eslint.config.mjs`
- `dependency-cruiser.cjs`
- `src/architecture-boundaries.test.ts`
