# Architecture Overview

This document provides a high-level view of the application architecture.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         src/app/                                │
│         (Routes, Layouts, API Handlers, Pages)                  │
│                     ↓ imports from                              │
├─────────────────────────────────────────────────────────────────┤
│                        src/shared/                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ models/  │ │services/ │ │  lib/    │ │ blocks/components│   │
│  │ (DAL)    │ │(business)│ │(utility) │ │     (UI)         │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
│       │            │            │                │              │
│       ↓            ↓            ↓                ↓              │
├───────┴────────────┴────────────┴────────────────┴──────────────┤
│                         src/core/                               │
│       ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│       │  auth  │  │   db   │  │  i18n  │  │ theme  │           │
│       └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘           │
│           │           │           │           │                 │
│           ↓           ↓           ↓           ↓                 │
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
- **Responsibility**: Thin layer for routing and request/response handling
- **Rules**:
  - Keep page/layout files thin
  - Delegate logic to `shared/` services
  - Route handlers use `withApi()` wrapper

### `src/shared/` - Business & UI Layer

| Directory     | Responsibility               | Boundary          |
| ------------- | ---------------------------- | ----------------- |
| `models/`     | Data access layer (DAL)      | Server-only       |
| `services/`   | Business logic orchestration | Server-only       |
| `lib/`        | Cross-cutting utilities      | Mixed             |
| `blocks/`     | Page-level UI compositions   | Client-safe       |
| `components/` | Reusable UI components       | Client-safe       |
| `contexts/`   | React contexts               | Client-only       |
| `hooks/`      | React hooks                  | Client-only       |
| `constants/`  | Shared constants             | Leaf (no imports) |

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
| `storage/`   | S3, Cloudflare R2       |
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
app/ → shared/, core/, config/, extensions/
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
3. **Constants as leaves**: `shared/constants` cannot import services/models/core
4. **Route handler isolation**: `src/app/**/route.ts` cannot import UI components

## Request Flow

### API Request

```
Request → src/middleware.ts → route.ts → withApi() → service → model → db
                ↓              ↓           ↓         ↓        ↓
          x-request-id    validation   logging   business   data
```

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
// src/shared/services/payment.ts
export async function getPaymentService() {
  const configs = await getAllConfigs();
  const manager = new PaymentManager();

  if (configs.stripe_enabled) {
    manager.addProvider(new StripeProvider(configs));
  }

  return manager;
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
| Production (Vercel)     | Serverless | Edge functions, ISR       |
| Production (Cloudflare) | Hyperdrive | Workers, KV, D1           |
| Production (Docker)     | Singleton  | Traditional server        |

## Related Documents

- [Auth Guide](../guides/auth.md) - Authentication architecture
- [RBAC Guide](../guides/rbac.md) - Permission system
- [Payment Guide](../guides/payment.md) - Payment integration
- [Database Guide](../guides/database.md) - Database patterns
- [API Reference](../api/reference.md) - API documentation
- [shared-layering.md](./shared-layering.md) - Detailed `shared/` layer rules
