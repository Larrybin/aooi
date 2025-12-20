# Payment Integration Guide

This guide covers the multi-provider payment system supporting one-time payments and subscriptions.

## Architecture Overview

```
src/extensions/payment/
├── index.ts        # Core interfaces, PaymentManager, types
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

Central manager for all payment providers:

```typescript
import { paymentManager, PaymentManager } from '@/extensions/payment';

// Get a specific provider
const stripe = paymentManager.getProvider('stripe');

// Get default provider
const defaultProvider = paymentManager.getDefaultProvider();

// Create payment with specific provider
const session = await paymentManager.createPayment({
  order: checkoutOrder,
  provider: 'stripe',
});
```

### PaymentProvider Interface

All providers implement this interface:

```typescript
interface PaymentProvider {
  readonly name: string;
  configs: PaymentConfigs;
  
  // Create checkout session
  createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession>;
  
  // Get payment session details
  getPaymentSession({ sessionId }: { sessionId: string }): Promise<PaymentSession>;
  
  // Handle webhook event
  getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent>;
  
  // Optional: Get invoice
  getPaymentInvoice?({ invoiceId }: { invoiceId: string }): Promise<PaymentInvoice>;
  
  // Optional: Get billing portal URL
  getPaymentBilling?({ customerId, returnUrl }): Promise<PaymentBilling>;
  
  // Optional: Cancel subscription
  cancelSubscription?({ subscriptionId }): Promise<PaymentSession>;
}
```

## Supported Providers

| Provider | One-Time | Subscription | Webhook |
|----------|----------|--------------|---------|
| Stripe | ✓ | ✓ | ✓ |
| PayPal | ✓ | ✓ | ✓ |
| Creem | ✓ | ✓ | ✓ |

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
  // 1. Parse & validate request
  const { product_id, currency, payment_provider } = 
    await parseJson(req, PaymentCheckoutBodySchema);
  
  // 2. Get pricing from server-side data (never trust client amount)
  const pricingItem = pricing.items.find(item => item.product_id === product_id);
  
  // 3. Validate payment provider
  const paymentService = await getPaymentService();
  const provider = paymentService.getProvider(paymentProviderName);
  
  // 4. Create order record
  const order = await createOrder({
    orderNo: getSnowId(),
    userId: user.id,
    amount: checkoutAmount,  // Server-calculated
    currency: checkoutCurrency,
    // ...
  });
  
  // 5. Create checkout session
  const result = await provider.createPayment({ order: checkoutOrder });
  
  // 6. Return checkout URL
  return jsonOk(result.checkoutInfo);
});
```

### 3. Checkout Response

```typescript
interface CheckoutInfo {
  sessionId: string;
  checkoutUrl: string;  // Redirect user here
}
```

## Order Status Flow

```
PENDING → CREATED → PAID (success)
    ↓         ↓
    └─────────┴──→ COMPLETED (failed) / FAILED
```

| Status | Description |
|--------|-------------|
| `PENDING` | Order saved, waiting for checkout |
| `CREATED` | Checkout session created, waiting for payment |
| `PAID` | Payment successful |
| `COMPLETED` | Checkout completed but failed |
| `FAILED` | Payment failed |

## Webhook Handling

### Endpoint

```
POST /api/payment/notify/[provider]
```

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

### Error Handling

The webhook handler maps provider errors to HTTP status codes:

| Error Type | HTTP Status |
|------------|-------------|
| `WebhookVerificationError` | 401 Unauthorized |
| `WebhookPayloadError` | 400 Bad Request |
| `WebhookConfigError` | 500 Internal Error |

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

| Config Key | Description |
|------------|-------------|
| `default_payment_provider` | Default provider name |
| `stripe_secret_key` | Stripe API secret key |
| `stripe_webhook_secret` | Stripe webhook signing secret |
| `paypal_client_id` | PayPal client ID |
| `paypal_client_secret` | PayPal client secret |
| `creem_api_key` | Creem API key |
| `creem_product_ids` | JSON mapping of product IDs |

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
5. **Log payment events** - For audit trails and debugging

## Provider-Specific Setup

### Stripe

1. Get API keys from [Stripe Dashboard](https://dashboard.stripe.com)
2. Set `stripe_secret_key` in database configs
3. Configure webhook endpoint: `https://your-domain.com/api/payment/notify/stripe`
4. Set `stripe_webhook_secret` from webhook settings

### PayPal

1. Get credentials from [PayPal Developer](https://developer.paypal.com)
2. Set `paypal_client_id` and `paypal_client_secret`
3. Configure webhook: `https://your-domain.com/api/payment/notify/paypal`

### Creem

1. Get API key from Creem dashboard
2. Set `creem_api_key`
3. Optionally configure `creem_product_ids` for product mapping

## Related Files

- `src/extensions/payment/index.ts` - Core interfaces and PaymentManager
- `src/extensions/payment/stripe.ts` - Stripe implementation
- `src/extensions/payment/paypal.ts` - PayPal implementation
- `src/extensions/payment/creem.ts` - Creem implementation
- `src/app/api/payment/checkout/route.ts` - Checkout API
- `src/app/api/payment/notify/[provider]/route.ts` - Webhook handler
- `src/shared/services/payment.ts` - Payment service layer
- `src/shared/models/order.ts` - Order model
- `src/shared/models/subscription.ts` - Subscription model
