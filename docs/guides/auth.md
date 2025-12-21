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

```typescript
// src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';

export async function POST(request: Request) {
  const auth = await getAuth();
  const handler = toNextJsHandler(auth.handler);
  return handler.POST(request);
}

export async function GET(request: Request) {
  const auth = await getAuth();
  const handler = toNextJsHandler(auth.handler);
  return handler.GET(request);
}
```

### Getting Auth Instance

Always use `getAuth()` in server-side code:

```typescript
import { getAuth } from '@/core/auth';

// In a Route Handler or Server Action
const auth = await getAuth();
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

| Config Key               | Description                   |
| ------------------------ | ----------------------------- |
| `google_client_id`       | Google OAuth Client ID        |
| `google_client_secret`   | Google OAuth Client Secret    |
| `google_one_tap_enabled` | Enable Google One Tap sign-in |

#### GitHub OAuth

| Config Key             | Description                |
| ---------------------- | -------------------------- |
| `github_client_id`     | GitHub OAuth Client ID     |
| `github_client_secret` | GitHub OAuth Client Secret |

## Environment Variables

### Required

| Variable                              | Description                                            |
| ------------------------------------- | ------------------------------------------------------ |
| `BETTER_AUTH_SECRET` or `AUTH_SECRET` | Secret key for signing tokens (required in production) |
| `DATABASE_URL`                        | PostgreSQL connection string                           |

### Optional

| Variable              | Description                   |
| --------------------- | ----------------------------- |
| `BETTER_AUTH_URL`     | Override auth base URL        |
| `NEXT_PUBLIC_APP_URL` | Application URL for callbacks |

## Database Schema

Better Auth uses the following tables (managed by Drizzle adapter):

- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth provider accounts
- `verification` - Email verification tokens

## Trusted Origins

The auth system automatically trusts:

1. Your application URL (`NEXT_PUBLIC_APP_URL`)
2. Google accounts domain (`https://accounts.google.com`) for One Tap

```typescript
const trustedOrigins: string[] = [];
if (envConfigs.app_url) {
  trustedOrigins.push(envConfigs.app_url);
}
trustedOrigins.push('https://accounts.google.com');
```

## Security Best Practices

1. **Always set `BETTER_AUTH_SECRET`** in production with a strong random value
2. **Never expose auth secrets** to client-side code
3. **Use HTTPS** in production for secure cookie transmission
4. **Validate sessions server-side** before performing sensitive operations

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

1. Check OAuth provider settings for correct callback URL: `https://your-domain.com/api/auth/callback/google`
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
- `src/shared/services/auth.ts` - Auth service utilities
