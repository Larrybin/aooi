# Payment Integration Guide

This guide covers the multi-provider payment system supporting one-time payments and subscriptions.

## Architecture Overview

```
src/extensions/payment/
├── index.ts        # Core interfaces, PaymentManager, types
├── adapter.ts      # Provider adapter (validation + mapping)
├── providers.ts    # Provider exports (server-only)
├── stripe.ts       # Stripe provider implementation
├── paypal.ts       # PayPal provider implementation
├── creem.ts        # Creem provider implementation
└── types.ts        # Additional type definitions

src/app/api/payment/
├── checkout/route.ts              # Create checkout session
├── callback/route.ts              # Handle checkout callback
└── notify/[provider]/route.ts     # Webhook notifications
```

## Core Concepts

### PaymentManager

`PaymentManager` is the in-memory registry for all payment providers.
In application code, prefer the service-assembled instance (built from the latest configs):

```typescript
import { getPaymentService } from '@/shared/services/payment';

const paymentService = await getPaymentService();

// Get a specific provider (or fallback to default)
const provider =
  paymentService.getProvider('stripe') ?? paymentService.getDefaultProvider();

if (!provider) throw new Error('payment provider not configured');
const session = await provider.createPayment({ order: checkoutOrder });
```

### PaymentProvider Interface

Application code only relies on this stable interface:

```typescript
interface PaymentProvider {
  readonly name: string;
  configs: PaymentConfigs;

  // Create checkout session
  createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession>;

  // Get payment session details
  getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession>;

  // Handle webhook event
  getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent>;

  // Optional: Get invoice
  getPaymentInvoice?({
    invoiceId,
  }: {
    invoiceId: string;
  }): Promise<PaymentInvoice>;

  // Optional: Get billing portal URL
  getPaymentBilling?({ customerId, returnUrl }): Promise<PaymentBilling>;

  // Optional: Cancel subscription
  cancelSubscription?({ subscriptionId }): Promise<PaymentSession>;
}
```

Provider implementations are treated as _drivers_ and are wrapped by `PaymentProviderAdapter` during service assembly (`src/shared/services/payment/manager.ts`). The adapter is responsible for:

- Runtime validation (schema checks) at the provider boundary
- Converting provider-specific raw payloads into JSON-serializable values before they are persisted/logged

## Supported Providers

| Provider | One-Time | Subscription | Webhook |
| -------- | -------- | ------------ | ------- |
| Stripe   | ✓        | ✓            | ✓       |
| PayPal   | ✓        | ✓            | ✓       |
| Creem    | ✓        | ✓            | ✓       |

## Payment Types

```typescript
enum PaymentType {
  ONE_TIME = 'one-time',
  SUBSCRIPTION = 'subscription',
  RENEW = 'renew',
}

enum PaymentInterval {
  ONE_TIME = 'one-time',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}
```

## Checkout Flow

### 1. Client Request

See [API Reference - Checkout Request](../api/reference.md#checkout-request) for full request/response format.

```typescript
// POST /api/payment/checkout
{
  "product_id": "pro_monthly",
  "currency": "usd",
  "payment_provider": "stripe"  // optional
}
```

### 2. Server Processing

```typescript
// src/app/api/payment/checkout/route.ts
export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;

  // Parse & validate request
  const { product_id, currency, locale, payment_provider, metadata } =
    await api.parseJson(PaymentCheckoutBodySchema);

  // Resolve pricing from server-side data (never trust client amount)
  const t = await getTranslations({
    locale: locale || 'en',
    namespace: 'pricing',
  });
  const pricing = t.raw('pricing') as Pricing;

  const pricingItem = findPricingItemByProductId(pricing, product_id);
  if (!pricingItem) {
    throw new NotFoundError('pricing item not found');
  }

  const user = await api.requireUser();

  // Load latest configs + create checkout session (order creation, provider selection, callbacks)
  const configs = await getAllConfigs();
  const checkoutInfo = await createPaymentCheckoutSession({
    pricingItem,
    user,
    configs,
    currency,
    locale,
    paymentProvider: payment_provider,
    metadata,
    log,
  });

  return jsonOk(checkoutInfo);
});
```

### 3. Checkout Response

```typescript
interface CheckoutInfo {
  sessionId: string;
  checkoutUrl: string; // Redirect user here
}
```

Notes:
- All internal amounts use the smallest currency unit (e.g., cents); provider payloads convert to major units when required (Stripe/PayPal).
- Callback base URL is derived from `NEXT_PUBLIC_APP_URL` origin (http/https only, trailing `/` stripped). Invalid origins fail fast.
- Locale is optional; default locale uses as-needed routing (no prefix). Non-default locales add a `/locale` prefix; `zh-CN` is normalized to `zh`. Unsupported locales are rejected.

### 4. Return URL & Finalization

After the provider redirects back to the app, the UI finalizes the order by calling the callback API:

- The provider `successUrl` points to one of:
  - `/<locale?>/settings/payments?order_no=...` (one-time)
  - `/<locale?>/settings/billing?order_no=...` (subscription)
- The settings pages render `PaymentCallbackHandler` (`src/shared/blocks/payment/payment-callback.tsx`), which:
  - `POST /api/payment/callback` with `{ order_no }` to confirm the payment session
  - Removes `order_no` from the URL after success

`GET /api/payment/callback` is kept as a legacy redirect-only endpoint (see `docs/api/reference.md`), and performs ownership checks before redirecting.

## Order Status Flow

```
PENDING → CREATED → PAID (success)
    ↓         ↓
COMPLETED    FAILED
```

| Status      | Description                                   |
| ----------- | --------------------------------------------- |
| `PENDING`   | Order saved, waiting for checkout             |
| `CREATED`   | Checkout session created, waiting for payment |
| `PAID`      | Payment successful                            |
| `COMPLETED` | Checkout session creation failed (upstream)   |
| `FAILED`    | Payment failed or canceled                    |

## Webhook Handling

### Endpoint

```
POST /api/payment/notify/[provider]
```

### Signature Verification (Provider Requirements)

The payment providers verify signatures at the provider boundary:

- **Stripe**: requires `stripe-signature` header and `stripe_signing_secret`
- **PayPal**: requires `paypal_webhook_id` and PayPal transmission headers (e.g. `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time`, `paypal-cert-id`, `paypal-auth-algo`)
- **Creem**: requires `creem-signature` header and `creem_signing_secret`

### Supported Events

```typescript
enum PaymentEventType {
  CHECKOUT_SUCCESS = 'checkout.success',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  SUBSCRIBE_UPDATED = 'subscribe.updated',
  SUBSCRIBE_CANCELED = 'subscribe.canceled',
}
```

### Handling Behavior (Route Handler)

`src/app/api/payment/notify/[provider]/route.ts` currently handles:

- `checkout.success` → finalize order via `session.metadata.order_no`
- `payment.success` → only subscription renewal (`subscriptionCycleType === 'renew'`); first subscription payment is ignored
- `subscribe.updated` / `subscribe.canceled` → update subscription state

Other event types are currently ignored (logged as `payment: notify ignored event type`).

### Error Handling

The webhook handler maps provider errors to HTTP status codes:

| Error Type                 | HTTP Status        |
| -------------------------- | ------------------ |
| `WebhookVerificationError` | 401 Unauthorized   |
| `WebhookPayloadError`      | 400 Bad Request    |
| `WebhookConfigError`       | 500 Internal Error |

### Idempotency

The webhook handler includes idempotency protection:

```typescript
// Skip if order already processed
if (
  order.status === OrderStatus.PAID ||
  order.status === OrderStatus.FAILED ||
  order.status === OrderStatus.COMPLETED
) {
  return jsonOk({ message: 'already processed' });
}
```

For subscription renewals, the handler also attempts to dedupe by `transactionId` or `invoiceId` when present.

## Subscription Management

### Subscription Status

```typescript
enum SubscriptionStatus {
  ACTIVE = 'active',
  PENDING_CANCEL = 'pending_cancel',
  CANCELED = 'canceled',
  TRIALING = 'trialing',
  EXPIRED = 'expired',
  PAUSED = 'paused',
}
```

### Subscription Info

```typescript
interface SubscriptionInfo {
  subscriptionId: string;
  planId?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  interval?: PaymentInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingUrl?: string;
  status?: SubscriptionStatus;
  canceledAt?: Date;
  canceledReason?: string;
}
```

## Configuration

### Database Configs

| Config Key                 | Description                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `select_payment_enabled`   | Allow users to select provider; if disabled, use `default_payment_provider`         |
| `default_payment_provider` | Default provider name (`stripe`/`paypal`/`creem`)                                   |
| `stripe_enabled`           | Enable Stripe provider                                                              |
| `stripe_publishable_key`   | Stripe publishable key (stored for client use; not required server-side)            |
| `stripe_secret_key`        | Stripe API secret key                                                               |
| `stripe_signing_secret`    | Stripe webhook signing secret (required in production when Stripe enabled)          |
| `stripe_payment_methods`   | Allowed methods for **CNY one-time** Stripe checkout (`card`/`wechat_pay`/`alipay`) |
| `paypal_enabled`           | Enable PayPal provider                                                              |
| `paypal_environment`       | `sandbox` or `production`                                                           |
| `paypal_client_id`         | PayPal client ID                                                                    |
| `paypal_client_secret`     | PayPal client secret                                                                |
| `paypal_webhook_id`        | PayPal webhook id (for signature verification)                                      |
| `creem_enabled`            | Enable Creem provider                                                               |
| `creem_environment`        | `sandbox` or `production`                                                           |
| `creem_api_key`            | Creem API key                                                                       |
| `creem_signing_secret`     | Creem signing secret (webhook verification)                                         |
| `creem_product_ids`        | JSON object mapping product IDs / product+currency to provider product IDs          |

### Runtime Environment

Payment flows rely on these public env configs (merged into `getAllConfigs()`), and are used for callback URLs and CSRF host validation:

| Env Var                      | Purpose                             |
| ---------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_APP_URL`        | Base URL for callback/cancel routes |
| `NEXT_PUBLIC_APP_NAME`       | Persisted into `order.metadata`     |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Locale routing for callback URLs    |

### Pricing Configuration

Pricing is defined in locale files (e.g., `src/config/locale/messages/en/pricing.json`):

```json
{
  "pricing": {
    "items": [
      {
        "product_id": "pro_monthly",
        "product_name": "Pro Monthly",
        "amount": 1999,
        "currency": "usd",
        "interval": "month",
        "credits": 1000,
        "payment_providers": ["stripe", "paypal"],
        "currencies": [
          {
            "currency": "eur",
            "amount": 1899,
            "payment_providers": ["stripe"]
          }
        ]
      }
    ]
  }
}
```

## Security Considerations

1. **Never trust client-provided amounts** - Always calculate from server-side pricing data
2. **Validate payment providers** - Check against allowed providers per product/currency
3. **Verify webhook signatures** - Each provider implementation verifies signatures
4. **Use idempotency** - Prevent duplicate processing of webhooks
5. **CSRF guard on authenticated POSTs** - Cookie-based write requests must be same-origin (Origin/Referer host must match)
6. **Log payment events** - For audit trails and debugging

## Provider-Specific Setup

### Stripe

1. Get API keys from [Stripe Dashboard](https://dashboard.stripe.com)
2. Enable Stripe: set `stripe_enabled=true`
3. Set `stripe_secret_key` (and optionally store `stripe_publishable_key`)
4. Configure webhook endpoint: `https://your-domain.com/api/payment/notify/stripe`
5. Set `stripe_signing_secret` from webhook settings (required for signature verification; enforced in production)

### PayPal

1. Get credentials from [PayPal Developer](https://developer.paypal.com)
2. Enable PayPal: set `paypal_enabled=true` and `paypal_environment` (`sandbox`/`production`)
3. Set `paypal_client_id` and `paypal_client_secret`
4. Create a webhook and set `paypal_webhook_id`
5. Configure webhook: `https://your-domain.com/api/payment/notify/paypal`

### Creem

1. Get API key from Creem dashboard
2. Enable Creem: set `creem_enabled=true` and `creem_environment` (`sandbox`/`production`)
3. Set `creem_api_key` and `creem_signing_secret`
4. Optionally configure `creem_product_ids` for product mapping

## Related Files

- `src/extensions/payment/index.ts` - Core interfaces and PaymentManager
- `src/extensions/payment/adapter.ts` - Provider adapter (validation + mapping)
- `src/extensions/payment/stripe.ts` - Stripe implementation
- `src/extensions/payment/paypal.ts` - PayPal implementation
- `src/extensions/payment/creem.ts` - Creem implementation
- `src/app/api/payment/checkout/route.ts` - Checkout API
- `src/app/api/payment/callback/route.ts` - Checkout callback/finalize
- `src/app/api/payment/notify/[provider]/route.ts` - Webhook handler
- `src/shared/services/payment.ts` - Payment service layer
- `src/shared/services/payment/manager.ts` - Payment service assembly (configs → providers)
- `src/shared/services/payment/checkout.ts` - Checkout orchestration
- `src/shared/services/payment/flows.ts` - Order/subscription state transitions
- `src/shared/lib/payment/pricing.ts` - Pricing resolution + allowed providers
- `src/shared/schemas/api/payment/*.ts` - API request/params schemas
- `src/shared/blocks/payment/payment-callback.tsx` - Client-side callback finalization
- `src/shared/services/settings/definitions/payment.ts` - Payment config keys/settings schema
- `src/shared/models/order.ts` - Order model
- `src/shared/models/subscription.ts` - Subscription model
