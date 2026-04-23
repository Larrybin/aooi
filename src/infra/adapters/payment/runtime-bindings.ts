import 'server-only';

import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import type { PaymentRuntimeBindings } from '@/domains/settings/application/settings-runtime.contracts';

function readPaymentRuntimeBindings(): PaymentRuntimeBindings {
  return {
    stripePublishableKey:
      getRuntimeEnvString('STRIPE_PUBLISHABLE_KEY')?.trim() || '',
    stripeSecretKey: getRuntimeEnvString('STRIPE_SECRET_KEY')?.trim() || '',
    stripeSigningSecret:
      getRuntimeEnvString('STRIPE_SIGNING_SECRET')?.trim() || '',
    creemApiKey: getRuntimeEnvString('CREEM_API_KEY')?.trim() || '',
    creemSigningSecret:
      getRuntimeEnvString('CREEM_SIGNING_SECRET')?.trim() || '',
    paypalClientId: getRuntimeEnvString('PAYPAL_CLIENT_ID')?.trim() || '',
    paypalClientSecret:
      getRuntimeEnvString('PAYPAL_CLIENT_SECRET')?.trim() || '',
    paypalWebhookId: getRuntimeEnvString('PAYPAL_WEBHOOK_ID')?.trim() || '',
  };
}

export function getPaymentRuntimeBindings(): PaymentRuntimeBindings {
  return { ...readPaymentRuntimeBindings() };
}
