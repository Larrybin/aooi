import 'server-only';

import { PaymentManager } from '@/extensions/payment';
import {
  CreemProvider,
  PayPalProvider,
  StripeProvider,
} from '@/extensions/payment/providers';
import { logger } from '@/shared/lib/logger.server';
import type { Configs } from '@/shared/models/config';
import { parseStripePaymentMethodsConfig } from '@/shared/services/settings/validators/payment';

import { buildServiceFromLatestConfigs } from '../config_refresh_policy';

/**
 * Get payment service with configs
 */
export function getPaymentServiceWithConfigs(configs: Configs) {
  const paymentManager = new PaymentManager();

  const defaultProvider = configs.default_payment_provider;

  if (configs.stripe_enabled === 'true') {
    const isProduction = process.env.NODE_ENV === 'production';
    const signingSecret = configs.stripe_signing_secret || '';
    if (isProduction && !signingSecret.trim()) {
      throw new Error('stripe_signing_secret is required in production');
    }

    let allowedPaymentMethods: string[] = ['card'];
    const stripePaymentMethodsConfig = configs.stripe_payment_methods;

    if (typeof stripePaymentMethodsConfig === 'string') {
      const result = parseStripePaymentMethodsConfig(
        stripePaymentMethodsConfig
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

  if (configs.creem_enabled === 'true') {
    paymentManager.addProvider(
      new CreemProvider({
        apiKey: configs.creem_api_key,
        environment:
          configs.creem_environment === 'production' ? 'production' : 'sandbox',
        signingSecret: configs.creem_signing_secret,
      }),
      defaultProvider === 'creem'
    );
  }

  if (configs.paypal_enabled === 'true') {
    paymentManager.addProvider(
      new PayPalProvider({
        clientId: configs.paypal_client_id,
        clientSecret: configs.paypal_client_secret,
        environment:
          configs.paypal_environment === 'production'
            ? 'production'
            : 'sandbox',
      }),
      defaultProvider === 'paypal'
    );
  }

  return paymentManager;
}

/**
 * Global payment service
 */
let paymentService: PaymentManager | null = null;

/**
 * Get payment service instance
 *
 * Note:
 * - Keep current behavior: rebuild service from latest configs each call.
 * - This avoids stale configs after admin updates (strong consistency).
 */
export async function getPaymentService(): Promise<PaymentManager> {
  paymentService = await buildServiceFromLatestConfigs(
    getPaymentServiceWithConfigs
  );
  return paymentService;
}
