# Payment Integration Guide

This guide covers the multi-provider payment system supporting one-time payments and subscriptions.

## Architecture Overview

```text
src/domains/billing/
  domain/         # pricing, payment contracts, credit semantics
  application/    # checkout, notify, replay, order/subscription flows
  infra/          # billing-owned persistence
  ui/             # payment-specific UI

src/infra/adapters/payment/
  provider-contract.ts
  service.ts
  stripe|paypal|creem transports, mappers, façades

src/app/api/payment/
  checkout/route.ts
  callback/route.ts
  notify/[provider]/route.ts
```

`settings` stores payment-related fields and values only. Billing interprets provider enablement, pricing, subscription, and credit behavior.

## Core Concepts

- Domain contracts live in `src/domains/billing/domain/payment.ts`.
- Checkout orchestration lives in `src/domains/billing/application/checkout.ts`.
- Webhook notify orchestration lives in `src/domains/billing/application/payment-notify-flow.ts` and `process-payment-notify.ts`.
- Replay logic lives in `src/domains/billing/application/replay.ts`.
- Provider SDK/transport details live in `src/infra/adapters/payment/**`.

## Checkout Flow

1. `src/app/api/payment/checkout/route.ts` parses `PaymentCheckoutBodySchema`.
2. The route resolves pricing data and authenticated user context.
3. The route calls `createPaymentCheckoutSession()`.
4. Billing application code builds order/session semantics.
5. Payment adapter code creates the upstream checkout session.

Route handlers remain HTTP adapters; they should not own pricing rules or provider selection semantics.

## Webhook Flow

1. `src/app/api/payment/notify/[provider]/route.ts` parses provider route params.
2. The route reads runtime settings through `settings-runtime.query`.
3. The route passes request metadata into `handlePaymentNotifyRequest()`.
4. Billing application code records inbox/audit state and applies order/subscription transitions.
5. Payment adapters verify signatures and map provider payloads into canonical events.

## Supported Providers

| Provider | One-Time | Subscription | Webhook |
| -------- | -------- | ------------ | ------- |
| Stripe   | yes      | yes          | yes     |
| PayPal   | yes      | yes          | yes     |
| Creem    | yes      | yes          | yes     |

## Configuration

Payment settings are registered under `src/domains/settings/definitions/payment.ts`, persisted through `settings-store`, and read as values by billing/payment adapter code.

Examples:

- `stripe_enabled`
- `stripe_public_key`
- `stripe_private_key`
- `stripe_webhook_secret`
- `paypal_enabled`
- `creem_enabled`

Provider availability semantics belong to billing/provider assembly, not settings.

## Related Files

- `src/domains/billing/domain/payment.ts` - Canonical payment types and provider interface
- `src/domains/billing/domain/pricing.ts` - Pricing lookup and provider selection semantics
- `src/domains/billing/domain/credit.ts` - Credit semantics
- `src/domains/billing/application/checkout.ts` - Checkout orchestration
- `src/domains/billing/application/flows.ts` - Order/subscription state transitions
- `src/domains/billing/application/process-payment-notify.ts` - Notify pipeline
- `src/domains/billing/application/replay.ts` - Webhook replay
- `src/domains/billing/infra/order.ts` - Order persistence
- `src/domains/billing/infra/subscription.ts` - Subscription persistence
- `src/infra/adapters/payment/service.ts` - Payment runtime assembly
- `src/infra/adapters/payment/stripe.ts` - Stripe façade
- `src/infra/adapters/payment/paypal.ts` - PayPal façade
- `src/infra/adapters/payment/creem.ts` - Creem façade
- `src/shared/schemas/api/payment/*.ts` - HTTP request/params schemas
- `src/domains/billing/ui/payment-callback.tsx` - Client-side callback finalization
- `src/domains/settings/definitions/payment.ts` - Payment settings fields
