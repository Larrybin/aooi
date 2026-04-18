# Architecture Overview

This document provides a high-level view of the application architecture.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         src/app/                                │
│     (Route-only: Routes, Layouts, Route Handlers, Metadata)     │
│                     ↓ composes from                             │
├─────────────────────────────────────────────────────────────────┤
│                       src/features/                             │
│ ┌──────────────┐ ┌────────────────┐ ┌────────────────────────┐ │
│ │ admin/       │ │ web/           │ │ docs/                  │ │
│ │ server/      │ │ auth|chat/     │ │ server/content/        │ │
│ │ schemas/     │ │ components/    │ │ components/ (optional) │ │
│ └──────┬───────┘ │ server/        │ └────────────┬───────────┘ │
│        │         └────────┬───────┘              │             │
│        ↓                  ↓                      ↓             │
├─────────────────────────────────────────────────────────────────┤
│                        src/shared/                              │
│  Cross-surface primitives / utils / services / confirmed shell │
│   - models/, services/, lib/, constants/, types/               │
│   - blocks/components 仅保留真正跨面复用的 shell 与 primitives  │
│   - content/ 仅保留跨面 server-only 内容资产（如 email）        │
│                               ↓                                 │
├───────┴────────────┴────────────┴────────────────┴──────────────┤
│                         src/core/                               │
│       ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ ┌──────┐  │
│       │  auth  │  │   db   │  │  i18n  │  │ theme  │ │ docs │  │
│       └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘ └──┬───┘  │
│           │           │           │           │         │       │
│           ↓           ↓           ↓           ↓         ↓       │
├───────────┴───────────┴───────────┴───────────┴─────────────────┤
│                        src/config/                              │
│         (DB Schema, Locale Messages, Environment)               │
└─────────────────────────────────────────────────────────────────┘

                              ↕ integrates

┌─────────────────────────────────────────────────────────────────┐
│                      src/extensions/                            │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│    │ payment │  │   ai    │  │ storage │  │  email  │          │
│    └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### `src/app/` - Delivery Layer

- **Routes**: Next.js App Router pages and layouts
- **API Handlers**: Route Handlers (`route.ts`) for REST endpoints
- **Responsibility**: Route-only 入口层，只做组装、鉴权入口与 request/response handling
- **Rules**:
  - Keep page/layout files thin
  - Prefer delegating product logic to `features/**`
  - Use `shared/**` only for真正跨面能力
  - Route handlers prefer `withApi()` wrapper (contract exceptions like Better Auth may bypass it)

### `src/features/` - Product Surface Layer

| Directory                      | Responsibility                             | Boundary                  |
| ------------------------------ | ------------------------------------------ | ------------------------- |
| `features/admin/server`        | Admin 面 server orchestration / page setup | Server-only               |
| `features/admin/schemas`       | Admin form/action schema                   | Shared-within-feature     |
| `features/web/auth/components` | 用户端认证 UI                              | Client / RSC-safe by file |
| `features/web/chat/components` | 用户端 chat UI                             | Client / RSC-safe by file |
| `features/web/*/server`        | 用户端 server orchestration                | Server-only               |
| `features/docs/server/content` | docs/blog 本地内容流水线                   | Server-only               |

### `src/shared/` - Cross-Surface Layer

| Directory     | Responsibility                                | Boundary    |
| ------------- | --------------------------------------------- | ----------- |
| `models/`     | Cross-surface DAL / Repo                      | Server-only |
| `services/`   | Cross-surface domain orchestration            | Server-only |
| `lib/`        | Cross-cutting utilities                       | Mixed       |
| `blocks/`     | Confirmed cross-surface shell compositions    | Client-safe |
| `components/` | Shared UI primitives                          | Client-safe |
| `content/`    | Cross-surface server-only content assets only | Server-only |
| `constants/`  | Shared constants                              | Leaf        |
| `types/`      | Shared types                                  | Leaf-ish    |

### `src/core/` - Foundation Layer

| Module   | Responsibility                   |
| -------- | -------------------------------- |
| `auth/`  | Authentication (Better Auth)     |
| `db/`    | Database connection (Drizzle)    |
| `i18n/`  | Internationalization (next-intl) |
| `theme/` | Theme loading and management     |
| `docs/`  | Documentation source (fumadocs)  |

### `src/extensions/` - Integration Layer

Third-party service integrations with provider pattern:

| Extension    | Providers               |
| ------------ | ----------------------- |
| `payment/`   | Stripe, PayPal, Creem   |
| `ai/`        | OpenAI, Anthropic, etc. |
| `storage/`   | Cloudflare R2 binding   |
| `email/`     | Resend, etc.            |
| `analytics/` | Various analytics       |

### `src/config/` - Configuration Layer

| Directory          | Content                         |
| ------------------ | ------------------------------- |
| `db/schema.ts`     | Drizzle table definitions       |
| `db/migrations/`   | SQL migration files             |
| `locale/messages/` | i18n translation files          |
| `index.ts`         | Public config (`NEXT_PUBLIC_*`) |
| `server.ts`        | Server-only config              |

## Dependency Rules

### Allowed Imports

```
app/ → features/, shared/, core/, config/, extensions/
features/* → shared/, core/, config/, extensions/ (禁止 feature 之间直连)
shared/models/ → core/, config/
shared/services/ → core/, config/, extensions/, shared/models/
shared/lib/ → core/, config/
shared/blocks,components/ → shared/lib/, shared/hooks/, shared/contexts/
core/ → config/
extensions/ → config/ (self-contained)
config/ → (external packages only)
```

### Enforced by ESLint

The `eslint.config.mjs` enforces:

1. **Client/Server boundary**: Client modules cannot import `server-only`, `next/headers`, `@/core/db/**`
2. **DAL isolation**: `shared/models` cannot import UI or Next.js entry points
3. **Feature isolation**: `features/admin|web|docs` 之间禁止直接依赖
4. **Shared narrowing**: `shared/**` 默认不得依赖 `features/**`
5. **Feature server boundary**: `features/**/server/**` 禁止依赖 UI/client 层与 feature components
6. **Constants as leaves**: `shared/constants` cannot import services/models/core
7. **Route handler isolation**: `src/app/**/route.ts` cannot import UI components

## Request Flow

### API Request

```
Request → src/middleware.ts → route.ts → withApi() (most) → service → model → db
                ↓              ↓              ↓            ↓        ↓
          x-request-id    validation      logging      business    data
```

Some endpoints intentionally bypass `withApi()` (e.g. third-party handlers like Better Auth) to preserve response semantics (redirects/cookies/status codes).

### Page Request

```
Request → src/middleware.ts → page.tsx → Server Component → service → model
                ↓             ↓              ↓            ↓         ↓
           i18n/auth      layout        data fetch    business   data
```

## Key Patterns

### API Route Pattern

```typescript
export const POST = withApi(async (req: Request) => {
  const user = await requireUser(req); // Auth
  const body = await parseJson(req, Schema); // Validation
  const result = await service.doWork(body); // Business
  return jsonOk(result); // Response
});
```

### Service Pattern

```typescript
// src/core/payment/providers/service.ts
export async function getPaymentService() {
  return await buildServiceFromLatestConfigs(getPaymentServiceWithConfigs);
}
```

### Model Pattern

```typescript
// src/shared/models/user.ts
import 'server-only';

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export async function getUserById(id: string): Promise<User | undefined> {
  const [result] = await db().select().from(user).where(eq(user.id, id));
  return result;
}
```

## Environment Modes

| Environment             | DB Mode    | Features                  |
| ----------------------- | ---------- | ------------------------- |
| Development             | Serverless | Hot reload, debug logging |
| Production (Cloudflare) | Hyperdrive | Workers (OpenNext)        |
| Production (Docker)     | Singleton  | Traditional server        |

## Related Documents

- [Auth Guide](../guides/auth.md) - Authentication architecture
- [RBAC Guide](../guides/rbac.md) - Permission system
- [Payment Guide](../guides/payment.md) - Payment integration
- [Database Guide](../guides/database.md) - Database patterns
- [API Reference](../api/reference.md) - API documentation
- [shared-layering.md](./shared-layering.md) - Detailed `shared/` layer rules
