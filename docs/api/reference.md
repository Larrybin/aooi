# API Reference

This document covers the API route patterns, common utilities, and available endpoints.

## Route Handler Patterns

### Standard Structure

Most API routes use the `withApi()` wrapper for consistent error handling.

Contract exceptions exist (e.g. `/api/auth/[...all]` for Better Auth) where we intentionally bypass `withApi()` to preserve third-party semantics (redirects, cookies, status codes). These endpoints do not follow the `{code,message,data}` response envelope documented below.

```typescript
// src/app/api/example/route.ts
import { requireUser } from '@/shared/lib/api/guard';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

export const POST = withApi(async (req: Request) => {
  // 1. Authentication
  const user = await requireUser(req);

  // 2. Parse & validate input
  const body = await parseJson(req, MyRequestSchema);

  // 3. Business logic
  const result = await doSomething(body);

  // 4. Return response
  return jsonOk({ data: result });
});
```

### Request Parsing

```typescript
import { z } from 'zod';

import { parseJson, parseParams, parseQuery } from '@/shared/lib/api/parse';

// Parse JSON body
const BodySchema = z.object({
  name: z.string(),
  amount: z.number(),
});
const body = await parseJson(req, BodySchema);

// Parse query parameters
const QuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});
const query = parseQuery(req.url, QuerySchema);

// Parse route params
const ParamsSchema = z.object({
  id: z.string(),
});
const params = await parseParams(routeParams, ParamsSchema);
```

Notes:

- `parseJson()` enforces a default **1MB** request body limit and throws `PayloadTooLargeError` (HTTP 413) when exceeded.

### Response Helpers

```typescript
import { jsonCreated, jsonNoContent, jsonOk } from '@/shared/lib/api/response';

// 200 OK with data
return jsonOk({ user: userData });

// 201 Created
return jsonCreated({ id: newId });

// 204 No Content
return jsonNoContent();
```

### Error Handling

```typescript
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '@/shared/lib/api/errors';

// 400 Bad Request
throw new BadRequestError('Invalid input');

// 401 Unauthorized
throw new UnauthorizedError('Not authenticated');

// 403 Forbidden
throw new ForbiddenError('Access denied');

// 404 Not Found
throw new NotFoundError('Resource not found');

// 422 Unprocessable Entity
throw new UnprocessableEntityError('Validation failed');
```

For shared service code used by both Route Handlers and Server Actions, you can also throw:

- `BusinessError` (`src/shared/lib/errors.ts`) → mapped to HTTP 400 with its `publicMessage`
- `ExternalError` (`src/shared/lib/errors.ts`) → mapped to its HTTP status with its `publicMessage`

## Authentication Guards

```typescript
import { requireUser } from '@/shared/lib/api/guard';

// Throws UnauthorizedError if not authenticated
// Also enforces CSRF check for cookie-based write requests.
const user = await requireUser(req);

// User object includes:
// - id: string
// - email: string
// - name: string
// - image?: string
```

Notes:

- This repo commonly uses `POST` for cookie-authenticated endpoints (even if read-only) so `requireUser()` can enforce same-origin checks for requests carrying cookies.
- For endpoints returning user-specific data, set `Cache-Control: no-store`.
- CSRF compares Origin/Referer host with `Host` (and the configured `APP_URL` host). When running behind a proxy/CDN, ensure forwarded headers are sanitized/owned by the edge.

## Available Endpoints

### Authentication

| Method     | Endpoint             | Description                                         |
| ---------- | -------------------- | --------------------------------------------------- |
| `GET/POST` | `/api/auth/[...all]` | Better Auth handler (signin, signup, signout, etc.) |

Notes:

- `/api/auth/[...all]` is a passthrough to Better Auth and does not use `withApi()`; response shape and errors are defined by Better Auth.
- Treat `/api/auth/**` as sensitive: do not cache it at the edge. The route sets `Cache-Control: no-store`.
- `/api/auth/**` is validated by the Cloudflare smoke chain (`pnpm test:cf-local-smoke`, `pnpm test:cf-app-smoke`).

### User

| Method | Endpoint                     | Description             |
| ------ | ---------------------------- | ----------------------- |
| `POST` | `/api/user/get-user-info`    | Get current user info   |
| `POST` | `/api/user/get-user-credits` | Get user credit balance |

`POST /api/user/get-user-credits` returns:

```json
{
  "remainingCredits": 123,
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

- `expiresAt`: the earliest expiration time among remaining credits; `null` when there is no expiring credit.

### Payment

| Method | Endpoint                         | Description                               |
| ------ | -------------------------------- | ----------------------------------------- |
| `POST` | `/api/payment/checkout`          | Create checkout session                   |
| `GET`  | `/api/payment/callback`          | Legacy: redirect-only checkout callback   |
| `POST` | `/api/payment/callback`          | Finalize checkout (requires login + CSRF) |
| `POST` | `/api/payment/notify/[provider]` | Webhook notifications                     |

Notes:

- Current Cloudflare contract coverage is intentionally narrow: first-class webhook acceptance is gated around **Creem** signature verification plus duplicate-renewal idempotency (`pnpm test:creem-webhook-spike`).

#### Checkout Request

```typescript
// POST /api/payment/checkout
{
  "product_id": "pro_monthly",    // Required: Product ID from pricing
  "currency": "usd",               // Optional: Override currency
  "locale": "en",                  // Optional: Locale for callbacks (as-needed routing; non-default adds prefix; zh-CN -> zh)
  "payment_provider": "stripe",    // Optional: Specific provider
  "metadata": {}                   // Optional: Custom metadata
}
```

#### Checkout Response

```typescript
{
  "code": 0,
  "data": {
    "sessionId": "cs_xxx",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

### Chat / AI

| Method | Endpoint                    | Description                  |
| ------ | --------------------------- | ---------------------------- |
| `POST` | `/api/chat`                 | Chat completion              |
| `POST` | `/api/chat/new`             | Create new chat              |
| `POST` | `/api/chat/list`            | List user chats              |
| `POST` | `/api/chat/info`            | Get chat info                |
| `POST` | `/api/chat/messages`        | Get chat messages            |
| `POST` | `/api/ai/generate`          | AI generation                |
| `POST` | `/api/ai/query`             | AI query                     |
| `POST` | `/api/ai/notify/[provider]` | AI provider webhook callback |

Notes:

- `/api/chat` validates `model` against a server-side allowlist (see `src/shared/constants/chat-model-policy.ts`).
- `/api/chat` consumes user credits per request; returns 403 when credits are insufficient; credits are refunded when the completion fails.
- `/api/ai/notify/[provider]` is covered by Cloudflare app smoke through `POST /api/ai/notify/test-provider`, which must return `{ code: 0, message: "ok", data: { ok: true } }`.

### Configuration

| Method     | Endpoint                  | Description        |
| ---------- | ------------------------- | ------------------ |
| `GET/POST` | `/api/config/get-configs` | Get public configs |

### Storage

| Method | Endpoint                    | Description                      |
| ------ | --------------------------- | -------------------------------- |
| `POST` | `/api/storage/upload-image` | Upload image to storage provider |

Notes:

- Current Cloudflare contract coverage is intentionally narrow: first-class upload acceptance is gated around the **R2** path (`pnpm test:r2-upload-spike`).

### Email

| Method | Endpoint                 | Description                                     |
| ------ | ------------------------ | ----------------------------------------------- |
| `POST` | `/api/email/send-email`  | Send email verification code                    |
| `POST` | `/api/email/verify-code` | Verify email verification code                  |
| `POST` | `/api/email/test`        | Send verification test email (admin-only, RBAC) |

### Documentation

| Method | Endpoint           | Description                  |
| ------ | ------------------ | ---------------------------- |
| `GET`  | `/api/docs/search` | Search documentation content |

## Response Format

This section applies to endpoints wrapped with `withApi()` (the standard JSON envelope).
Contract exceptions (e.g. Better Auth) may return a different response shape.

### Success Response

```typescript
{
  "code": 0,
  "message": "ok",
  "data": { /* response data */ }
}
```

### Error Response

```typescript
{
  "code": -1,
  "message": "Error description",
  "data": { /* optional details, often null */ }
}
// HTTP status code carries 4xx/5xx.
```

Notes:

- For 5xx upstream failures, prefer throwing `UpstreamError(502|503)` and keep client-facing messages generic (`bad gateway` / `service unavailable`). Use `x-request-id` + server logs for details.

## Request ID Tracking

All requests include `x-request-id` header for tracing:

```typescript
import { getRequestLogger } from '@/shared/lib/request-logger.server';

export const POST = withApi(async (req: Request) => {
  const { log, requestId } = getRequestLogger(req);

  log.info('Processing request', { userId: user.id });
  log.error('Something failed', { error });

  // requestId is automatically included in all logs
});
```

## Middleware

The middleware (`src/middleware.ts`) handles:

1. **Request ID injection** - Adds `x-request-id` to all requests
2. **Internationalization** - Routes through next-intl
3. **Light auth check** - Checks session cookie for protected routes

Protected routes (`/admin`, `/settings`, `/activity`) require a session cookie. Full authentication is verified in the route handler.
For settings surfaces, see `docs/guides/settings.md`.

## Best Practices

1. **Prefer `withApi()`** - For consistent error handling and logging (except contract exceptions like Better Auth)
2. **Validate all inputs** - Use Zod schemas with parse helpers
3. **Use typed errors** - Throw specific error classes
4. **Log appropriately** - Use request logger for traceability
5. **Guard at entry** - Check auth/permissions at route entry

## Related Files

- `src/shared/lib/api/route.ts` - `withApi()` wrapper
- `src/shared/lib/api/guard.ts` - Auth guards
- `src/shared/lib/api/parse.ts` - Request parsing
- `src/shared/lib/api/response.ts` - Response helpers
- `src/shared/lib/api/errors.ts` - Error classes
- `src/middleware.ts` - Request middleware
