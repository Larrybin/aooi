# Authentication Guide

This guide covers the authentication system built on [Better Auth](https://better-auth.com), a framework-agnostic authentication library for TypeScript.

## Architecture Overview

```
src/core/auth/
├── index.ts      # Dynamic auth entry point (runtime)
├── config.ts     # Auth configuration (static + dynamic)
└── client.ts     # Client-side auth utilities
```

### Key Design: Static/Dynamic Configuration Separation

The auth system separates configuration into two layers to avoid database calls during build time:

1. **Static Configuration** (`authOptions`): No database dependency, safe for build time
2. **Dynamic Configuration** (`getAuthOptions()`): Loads database configs at runtime

```typescript
// Static - used during build, no DB calls
export const authOptions = {
  appName: envConfigs.app_name,
  baseURL: serverEnv.authBaseUrl,
  secret: serverEnv.authSecret,
  // ...
};

// Dynamic - used at runtime, fetches DB configs
export async function getAuthOptions() {
  const configs = await getAllConfigs();
  return {
    ...authOptions,
    database: drizzleAdapter(db(), { provider: 'pg', schema }),
    socialProviders: await getSocialProviders(configs),
    // ...
  };
}
```

## Server-Side Usage

### API Route Handler

The auth API is exposed via a catch-all route at `/api/auth/[...all]`:

Notes:

- This endpoint is a contract exception: it bypasses `withApi()` and does not return the standard `{code,message,data}` envelope (Better Auth controls redirects/cookies/status codes).
- The route is `force-dynamic`, and responses are marked `Cache-Control: no-store`.
- This route is exercised by the Cloudflare smoke chain (`pnpm test:cf-local-smoke` and `pnpm test:cf-app-smoke`).
- The local dual-runtime harness depends on a generated temporary Wrangler config whose `localConnectionString` points at a migrated Postgres instance. Tracked Wrangler templates keep `localConnectionString = ""`.

```typescript
// src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { setResponseHeader } from '@/shared/lib/api/response-headers';

export const dynamic = 'force-dynamic';

function withNoStore(response: Response): Response {
  return setResponseHeader(response, 'Cache-Control', 'no-store');
}

async function createHandler(request: Request) {
  const auth = await getAuth(request);
  return toNextJsHandler(auth.handler);
}

export async function POST(request: Request) {
  const handler = await createHandler(request);
  const response = await handler.POST(request);
  return withNoStore(response);
}

export async function GET(request: Request) {
  const handler = await createHandler(request);
  const response = await handler.GET(request);
  return withNoStore(response);
}
```

### Getting Auth Instance

Prefer `getAuth(request)` when a Request is available (enables per-request caching).
Otherwise `getAuth()` works too:

```typescript
import { getAuth } from '@/core/auth';

// In a Route Handler
const auth = await getAuth(request);
const session = await auth.api.getSession({ headers: request.headers });
```

## Client-Side Usage

### Basic Auth Client

```typescript
import { signIn, signOut, signUp, useSession } from '@/core/auth/client';

// Sign in with email/password
await signIn.email({ email, password });

// Sign up
await signUp.email({ email, password, name });

// Sign out
await signOut();

// React hook for session
const { data: session, isPending } = useSession();
```

### Auth Client with Dynamic Configs

For features like Google One Tap, use `getAuthClient()`:

```typescript
import { getAuthClient } from '@/core/auth/client';

// configs loaded from database
const authClient = getAuthClient(configs);

// Now supports Google One Tap if configured
```

## Supported Authentication Methods

### Email/Password

Enabled by default. Can be toggled via database config:

| Config Key           | Value          | Description                |
| -------------------- | -------------- | -------------------------- |
| `email_auth_enabled` | `true`/`false` | Enable email/password auth |

### Social Providers

#### Google OAuth

| Config Key               | Description                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `google_auth_enabled`    | `true`/`false` — Explicitly enable Google OAuth (required to activate even if keys exist) |
| `google_client_id`       | Google OAuth Client ID                                                                    |
| `google_client_secret`   | Google OAuth Client Secret                                                                |
| `google_one_tap_enabled` | Enable Google One Tap sign-in                                                             |

#### GitHub OAuth

| Config Key             | Description                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `github_auth_enabled`  | `true`/`false` — Explicitly enable GitHub OAuth (required to activate even if keys exist) |
| `github_client_id`     | GitHub OAuth Client ID                                                                    |
| `github_client_secret` | GitHub OAuth Client Secret                                                                |

## Environment Variables

### Required

| Variable                                               | Description                                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` or `AUTH_SECRET`                  | Secret key for signing tokens (required in production)                                             |
| `DATABASE_URL`                                         | PostgreSQL connection string (required in production unless running in Cloudflare Workers runtime) |
| `BETTER_AUTH_URL` / `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Auth base URL (must be a valid http/https origin; validated in production)                         |

Auth base URL 必须是纯 origin（如 `https://app.example.com`），不支持带路径/查询；生产环境缺失或无效会直接 fail-fast。

Notes:

- 为了让本地/CI 的 `pnpm build` 在未设置 `NEXT_PUBLIC_APP_URL` 时也能通过，构建阶段缺省会回退到 `http://localhost:3000`。
- 生产运行（`pnpm start`/部署）仍要求设置 `NEXT_PUBLIC_APP_URL`；同时 Next.js 会在 build 阶段内联 `NEXT_PUBLIC_*` 变量，因此发布构建务必提供正确值。
- 若部署在 Cloudflare Workers（`nodejs_compat`）并通过 Hyperdrive 提供连接串，则 `DATABASE_URL` 可为空；非 Workers 运行时生产环境仍要求 `DATABASE_URL`。
- 本地 Cloudflare smoke 默认从 `AUTH_SPIKE_DATABASE_URL` 或 `DATABASE_URL` 生成临时 Wrangler config；仓库里的 Wrangler 模板不存储本地数据库连接串。
- CI 中的 `Cloudflare Deploy Acceptance` 同样生成临时 Wrangler config，并把 `localConnectionString` 指到 Postgres service container。

### Optional

| Variable              | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `BETTER_AUTH_URL`     | Override auth base URL                                     |
| `AUTH_URL`            | Fallback auth base URL (if BETTER_AUTH_URL is not set)     |
| `NEXT_PUBLIC_APP_URL` | Application URL for callbacks (and auth base URL fallback) |

## Database Schema

Better Auth uses the following tables (managed by Drizzle adapter):

- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth provider accounts
- `verification` - Email verification tokens

## Trusted Origins

The auth system automatically trusts:

1. Your application URL (`NEXT_PUBLIC_APP_URL`) — normalized to a valid origin (`http`/`https` only, otherwise fail-fast in production)
2. Google accounts domain (`https://accounts.google.com`) for One Tap

If you serve the app from multiple origins (custom domains, preview URLs, reverse proxies), ensure the runtime origin matches `NEXT_PUBLIC_APP_URL` or extend `buildTrustedOrigins()` accordingly; otherwise requests may be incorrectly blocked (or allowed).

## Security Best Practices

1. **Always set `BETTER_AUTH_SECRET`** in production with a strong random value
2. **Always set auth base URL** (`BETTER_AUTH_URL`/`AUTH_URL`/`NEXT_PUBLIC_APP_URL`) to a valid origin; missing/invalid values fail fast in production
3. **Never expose auth secrets** to client-side code
4. **Use HTTPS** in production for secure cookie transmission
5. **Reset password is rate-limited** (per-email sliding window; `5m` window, `3` attempts, `1` concurrent; shared across instances via Cloudflare Durable Object); excessive requests are throttled to protect outbound providers

## Password Reset

### UI Routes

- Request reset email: `/<locale?>/forgot-password`
- Set new password (from email link): `/<locale?>/reset-password?token=...`
- Settings entry: `/<locale?>/settings/security` links to `forgot-password` (reset email request)

### Availability

Password reset UI is only available when email/password auth is enabled:

- Enabled when `email_auth_enabled !== 'false'`, or when neither Google nor GitHub auth is enabled (fallback).
- When disabled, the UI shows a "Password reset is not available." message and does not send emails.

### Throttling (Send Reset Email)

The server throttles `sendResetPassword` per email to protect outbound providers:

- Window: 5 minutes
- Max attempts per window: 3
- Max concurrent in-flight: 1
- Storage: Cloudflare Durable Object throttle (shared across instances)

### Reset Link Errors

The reset page accepts query params:

- `token`: required (from email link)
- `error`: may be `INVALID_TOKEN`

## Session Helpers (Server Components)

Prefer `getSignedInUser()` / `getSignedInUserSnapshot()` in Server Components and server-only helpers:

```typescript
import { getSignedInUser } from '@/shared/lib/auth-session.server';

const user = await getSignedInUser();
```

Related file: `src/shared/lib/auth-session.server.ts`

## Code Generation

If you need to regenerate Better Auth artifacts:

```bash
pnpm auth:generate
```

## Troubleshooting

### "Secret is not set" Error

```
AUTH_SECRET or BETTER_AUTH_SECRET must be set in production
```

**Solution**: Set `BETTER_AUTH_SECRET` in your environment variables with a strong random value (32+ characters).

### Session Not Persisting

**Possible causes**:

1. `NEXT_PUBLIC_APP_URL` doesn't match the actual domain
2. Cookies blocked by browser (check SameSite settings)
3. HTTPS required but running on HTTP

**Solution**: Verify `NEXT_PUBLIC_APP_URL` matches your domain exactly, including protocol.

### OAuth Callback Fails

```
OAuth callback error: redirect_uri_mismatch
```

**Solution**:

1. Check OAuth provider settings for correct callback URL: `https://example.com/api/auth/callback/google`
2. Ensure `NEXT_PUBLIC_APP_URL` is set correctly
3. Verify client ID and secret are correct

### "Database connection failed" During Auth

**Solution**:

1. Verify `DATABASE_URL` is set correctly
2. Run `pnpm db:migrate` to apply migrations
3. Check database connectivity

### Google One Tap Not Working

**Possible causes**:

1. `google_one_tap_enabled` not set to `true` in database config
2. Missing `google_client_id` in database config
3. Domain not verified in Google Cloud Console

**Solution**: Ensure all Google OAuth configs are set in the `config` table.

## Related Files

- `src/core/auth/index.ts` - Auth entry point
- `src/core/auth/config.ts` - Configuration
- `src/core/auth/client.ts` - Client utilities
- `src/app/api/auth/[...all]/route.ts` - API route
- `src/shared/lib/api/guard.ts` - Auth guards for API routes
- `src/shared/lib/auth-session.server.ts` - Session helpers (`getSignedInUser`)
- `src/config/server.ts` - Server-only env (`authBaseUrl`/`authSecret`)
