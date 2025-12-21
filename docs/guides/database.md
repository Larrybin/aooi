# Database Guide

This guide covers the database setup using Drizzle ORM with PostgreSQL.

## Architecture Overview

```
src/
├── core/db/
│   ├── index.ts       # Database connection factory
│   └── config.ts      # Drizzle Kit configuration
└── config/db/
    ├── schema.ts      # Table definitions (single source of truth)
    └── migrations/    # SQL migration files
```

## Database Connection

The `db()` function provides a Drizzle ORM instance with automatic environment detection:

```typescript
import { db } from '@/core/db';

// Use in any server-side code
const users = await db().select().from(user);
```

### Connection Modes

| Environment        | Mode        | Description                                      |
| ------------------ | ----------- | ------------------------------------------------ |
| Cloudflare Workers | Hyperdrive  | Uses `HYPERDRIVE` binding for connection pooling |
| Traditional Server | Singleton   | Reuses connection pool across requests           |
| Serverless         | Per-request | Creates new connection per invocation            |

### Configuration

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                      |
| `DB_SINGLETON_ENABLED` | `true` to enable singleton mode                   |
| `DATABASE_PROVIDER`    | Must be `postgresql` (any other value will throw) |

## Schema Definition

All tables are defined in `src/config/db/schema.ts` using Drizzle's type-safe API:

```typescript
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

### Core Tables

| Table             | Description                 |
| ----------------- | --------------------------- |
| `user`            | User accounts               |
| `session`         | Active sessions             |
| `account`         | OAuth provider accounts     |
| `verification`    | Email verification tokens   |
| `role`            | RBAC roles                  |
| `permission`      | RBAC permissions            |
| `user_role`       | User-role assignments       |
| `role_permission` | Role-permission assignments |
| `order`           | Payment orders              |
| `subscription`    | Active subscriptions        |
| `credit`          | User credits                |
| `config`          | System configuration        |

## Migrations

### Generate Migration

After modifying `schema.ts`:

```bash
pnpm db:generate
```

This creates a new SQL file in `src/config/db/migrations/`.

### Apply Migrations

```bash
pnpm db:migrate
```

**Important**: Always apply migrations before starting the app in staging/production.

### Migration Files

Migrations are stored as SQL files:

```
src/config/db/migrations/
├── 0000_initial.sql
├── 0001_nasty_vindicator.sql
└── meta/
    └── _journal.json
```

### Drizzle Studio

Visual database browser:

```bash
pnpm db:studio
```

Opens at http://local.drizzle.studio

## Data Access Layer

Data access functions live in `src/shared/models/`:

```typescript
// src/shared/models/user.ts
import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { user } from '@/config/db/schema';

export async function getUserById(id: string) {
  const [result] = await db().select().from(user).where(eq(user.id, id));
  return result;
}

export async function createUser(data: NewUser) {
  const [result] = await db().insert(user).values(data).returning();
  return result;
}
```

### Type Inference

Drizzle provides automatic type inference:

```typescript
// Infer select type
type User = typeof user.$inferSelect;

// Infer insert type
type NewUser = typeof user.$inferInsert;

// Partial update type
type UpdateUser = Partial<Omit<NewUser, 'id' | 'createdAt'>>;
```

## Query Patterns

### Basic Select

```typescript
import { and, desc, eq, like } from 'drizzle-orm';

import { db } from '@/core/db';
import { user } from '@/config/db/schema';

// Get by ID
const [user] = await db().select().from(user).where(eq(user.id, id));

// Multiple conditions
const users = await db()
  .select()
  .from(user)
  .where(and(eq(user.emailVerified, true), like(user.name, '%John%')))
  .orderBy(desc(user.createdAt))
  .limit(10);
```

### Joins

```typescript
import { order, user } from '@/config/db/schema';

const ordersWithUser = await db()
  .select({
    orderId: order.id,
    userName: user.name,
    amount: order.amount,
  })
  .from(order)
  .innerJoin(user, eq(order.userId, user.id));
```

### Transactions

```typescript
await db().transaction(async (tx) => {
  await tx.insert(order).values(orderData);
  await tx.insert(credit).values(creditData);
});
```

### Aggregations

```typescript
import { count, sum } from 'drizzle-orm';

const [result] = await db()
  .select({
    totalOrders: count(),
    totalAmount: sum(order.amount),
  })
  .from(order)
  .where(eq(order.status, 'paid'));
```

## Schema Validation

The database connection includes automatic schema validation. On startup, it checks for required columns (e.g., `role.deleted_at`). If migrations are missing:

```
Database schema mismatch: missing column public.role.deleted_at.
This usually means migrations were not applied.
Run: pnpm db:migrate
```

## Multi-Environment Support

### Cloudflare Workers + Hyperdrive

Configure in `wrangler.toml`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-id"
```

The `db()` function automatically detects and uses Hyperdrive.

### Vercel / AWS Lambda (Serverless)

Set `DB_SINGLETON_ENABLED=false` (default) for per-request connections.

### Traditional Server (Docker, VPS)

Set `DB_SINGLETON_ENABLED=true` for connection pooling.

## Best Practices

1. **Always use Drizzle ORM** - Avoid raw SQL unless absolutely necessary
2. **Use `server-only`** - Add to model files to prevent client imports
3. **Type your functions** - Use inferred types from schema
4. **Apply migrations in CI/CD** - Run `pnpm db:migrate` before deployment
5. **Use transactions** - For multi-table operations
6. **Index appropriately** - Add indexes in schema for common queries
7. **If using Supabase (PostgREST)** - Enable RLS on `public` tables and add explicit policies only where needed (see migration `src/config/db/migrations/0002_enable_rls_public_tables.sql`)

## Troubleshooting

### Connection Errors

```
DATABASE_URL is not set
```

Ensure `DATABASE_URL` is set in `.env` or environment variables.

### Migration Errors

```
Database schema mismatch
```

Run `pnpm db:migrate` to apply pending migrations.

### Hyperdrive Errors

```
Cloudflare Workers requires Hyperdrive binding
```

Configure `HYPERDRIVE` binding in `wrangler.toml`.

## Related Files

- `src/core/db/index.ts` - Database connection
- `src/config/db/schema.ts` - Schema definitions
- `src/config/db/migrations/` - Migration files
- `src/shared/models/` - Data access layer
