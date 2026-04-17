import 'server-only';

import { PaymentManager } from '@/core/payment/providers/manager';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { logger } from '@/shared/lib/logger.server';
import type { Configs } from '@/shared/models/config';
import { buildServiceFromLatestConfigs } from '@/shared/services/config_refresh_policy';
import { parseStripePaymentMethodsConfig } from '@/shared/services/settings/validators/payment';

async function addStripeProvider(
  paymentManager: PaymentManager,
  configs: Configs
) {
  const { StripeProvider } = await import('@/core/payment/providers/stripe');
  const defaultProvider = configs.default_payment_provider;
  const isProduction = process.env.NODE_ENV === 'production';
  const signingSecret = configs.stripe_signing_secret || '';

  if (isProduction && !signingSecret.trim()) {
    throw new ServiceUnavailableError(
      'stripe_signing_secret is required in production'
    );
  }

  let allowedPaymentMethods = ['card'];
  const stripePaymentMethodsConfig = configs.stripe_payment_methods;

  if (typeof stripePaymentMethodsConfig === 'string') {
    const result = parseStripePaymentMethodsConfig(stripePaymentMethodsConfig);
    if (!result.ok) {
      logger.warn(
        'payment: invalid stripe payment methods config, fallback to card',
        {
          error: result.error,
        }
      );
    } else {
      allowedPaymentMethods = result.methods;
    }
  }

  if (Array.isArray(stripePaymentMethodsConfig)) {
    const result = parseStripePaymentMethodsConfig(
      JSON.stringify(stripePaymentMethodsConfig)
    );
    if (!result.ok) {
      logger.warn(
        'payment: invalid stripe payment methods config, fallback to card',
        {
          error: result.error,
        }
      );
    } else {
      allowedPaymentMethods = result.methods;
    }
  }

  paymentManager.addProvider(
    new StripeProvider({
      secretKey: configs.stripe_secret_key,
      publishableKey: configs.stripe_publishable_key,
      signingSecret: configs.stripe_signing_secret,
      allowedPaymentMethods,
    }),
    defaultProvider === 'stripe'
  );
}

async function addCreemProvider(
  paymentManager: PaymentManager,
  configs: Configs
) {
  const { CreemProvider } = await import('@/core/payment/providers/creem');

  paymentManager.addProvider(
    new CreemProvider({
      apiKey: configs.creem_api_key,
      environment:
        configs.creem_environment === 'production' ? 'production' : 'sandbox',
      signingSecret: configs.creem_signing_secret,
    }),
    configs.default_payment_provider === 'creem'
  );
}

async function addPayPalProvider(
  paymentManager: PaymentManager,
  configs: Configs
) {
  const { PayPalProvider } = await import('@/core/payment/providers/paypal');

  paymentManager.addProvider(
    new PayPalProvider({
      clientId: configs.paypal_client_id,
      clientSecret: configs.paypal_client_secret,
      webhookId: configs.paypal_webhook_id,
      environment:
        configs.paypal_environment === 'production' ? 'production' : 'sandbox',
    }),
    configs.default_payment_provider === 'paypal'
  );
}

export async function getPaymentServiceWithConfigs(configs: Configs) {
  const paymentManager = new PaymentManager();

  if (configs.stripe_enabled === 'true') {
    await addStripeProvider(paymentManager, configs);
  }

  if (configs.creem_enabled === 'true') {
    await addCreemProvider(paymentManager, configs);
  }

  if (configs.paypal_enabled === 'true') {
    await addPayPalProvider(paymentManager, configs);
  }

  return paymentManager;
}

export async function getPaymentService(): Promise<PaymentManager> {
  return await buildServiceFromLatestConfigs(getPaymentServiceWithConfigs);
}
