# Billing Module

## What This Module Does

Billing covers the commercial mainline:

- pricing surface
- checkout session creation
- webhook handling
- subscription and credit-related purchase flows

## Required Configuration

- `default_payment_provider`
- `select_payment_enabled`
- provider-specific secrets under the `payment` tab

## External Services

- Stripe
- Creem
- PayPal

## Minimum Verification Commands

- `pnpm test:creem-webhook-spike`
- `pnpm test`

## Common Failure Modes

- Checkout renders but webhook verification is misconfigured.
- Product ID mapping drifts from pricing config.
- Provider is enabled in settings without the required signing secret.

## Product Impact If Disabled

The template can no longer sell plans, credits, or subscriptions through the default billing path.
