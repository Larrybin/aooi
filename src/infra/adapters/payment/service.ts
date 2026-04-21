import 'server-only';

import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';
import { isProductionEnv } from '@/shared/lib/env';
import { parseStripePaymentMethodsConfig } from '@/shared/lib/payment-config';
import type {
  CheckoutSession,
  PaymentEvent,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from '@/domains/billing/domain/payment';

const log = createUseCaseLogger({
  domain: 'billing',
  useCase: 'payment-adapter-service',
});

export type PaymentRuntimeSettings = Record<string, string | undefined>;

function getConfigValue(
  configs: PaymentRuntimeSettings,
  key: string
): string {
  return configs[key] ?? '';
}

async function addStripeProvider(
  registry: ProviderRegistry<PaymentProvider>,
  configs: PaymentRuntimeSettings
) {
  const { StripeProvider } = await import('@/infra/adapters/payment/stripe');
  const defaultProvider = configs.default_payment_provider;
  const isProduction = isProductionEnv();
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
      log.warn(
        'payment: invalid stripe payment methods config, fallback to card',
        {
          operation: 'parse-stripe-payment-methods',
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
      log.warn(
        'payment: invalid stripe payment methods config, fallback to card',
        {
          operation: 'parse-stripe-payment-methods',
          error: result.error,
        }
      );
    } else {
      allowedPaymentMethods = result.methods;
    }
  }

  registry.addUnique(
    new StripeProvider({
      secretKey: getConfigValue(configs, 'stripe_secret_key'),
      publishableKey: getConfigValue(configs, 'stripe_publishable_key'),
      signingSecret: getConfigValue(configs, 'stripe_signing_secret'),
      allowedPaymentMethods,
    }),
    {
      isDefault: defaultProvider === 'stripe',
      invalidNameError: () =>
        new ServiceUnavailableError('Payment provider name is required'),
      duplicateNameError: (name) =>
        new ServiceUnavailableError(
          `Payment provider '${name}' is already registered`
        ),
    }
  );
}

async function addCreemProvider(
  registry: ProviderRegistry<PaymentProvider>,
  configs: PaymentRuntimeSettings
) {
  const { CreemProvider } = await import('@/infra/adapters/payment/creem');

  registry.addUnique(
    new CreemProvider({
      apiKey: getConfigValue(configs, 'creem_api_key'),
      environment:
        configs.creem_environment === 'production' ? 'production' : 'sandbox',
      signingSecret: getConfigValue(configs, 'creem_signing_secret'),
    }),
    {
      isDefault: configs.default_payment_provider === 'creem',
      invalidNameError: () =>
        new ServiceUnavailableError('Payment provider name is required'),
      duplicateNameError: (name) =>
        new ServiceUnavailableError(
          `Payment provider '${name}' is already registered`
        ),
    }
  );
}

async function addPayPalProvider(
  registry: ProviderRegistry<PaymentProvider>,
  configs: PaymentRuntimeSettings
) {
  const { PayPalProvider } = await import('@/infra/adapters/payment/paypal');

  registry.addUnique(
    new PayPalProvider({
      clientId: getConfigValue(configs, 'paypal_client_id'),
      clientSecret: getConfigValue(configs, 'paypal_client_secret'),
      webhookId: getConfigValue(configs, 'paypal_webhook_id'),
      environment:
        configs.paypal_environment === 'production' ? 'production' : 'sandbox',
    }),
    {
      isDefault: configs.default_payment_provider === 'paypal',
      invalidNameError: () =>
        new ServiceUnavailableError('Payment provider name is required'),
      duplicateNameError: (name) =>
        new ServiceUnavailableError(
          `Payment provider '${name}' is already registered`
        ),
    }
  );
}

export type PaymentService = {
  getProvider(name: string): PaymentProvider | undefined;
  getDefaultProvider(): PaymentProvider | undefined;
  createPayment(input: {
    order: PaymentOrder;
    provider?: string;
  }): Promise<CheckoutSession>;
  getPaymentSession(input: {
    sessionId: string;
    provider?: string;
  }): Promise<PaymentSession>;
  getPaymentEvent(input: {
    req: Request;
    provider?: string;
  }): Promise<PaymentEvent>;
};

export async function getPaymentServiceWithConfigs(
  configs: PaymentRuntimeSettings
): Promise<PaymentService> {
  const registry = new ProviderRegistry<PaymentProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  if (configs.stripe_enabled === 'true') {
    await addStripeProvider(registry, configs);
  }

  if (configs.creem_enabled === 'true') {
    await addCreemProvider(registry, configs);
  }

  if (configs.paypal_enabled === 'true') {
    await addPayPalProvider(registry, configs);
  }

  const resolveProvider = (provider?: string) => {
    if (provider) {
      return registry.getRequired(
        provider,
        (name) => new BadRequestError(`Payment provider '${name}' not found`)
      );
    }
    return registry.getDefaultRequired(
      () => new ServiceUnavailableError('No payment provider configured')
    );
  };

  return {
    getProvider: (name) => registry.get(name),
    getDefaultProvider: () => registry.getDefault(),
    async createPayment(input) {
      return await resolveProvider(input.provider).createPayment({
        order: input.order,
      });
    },
    async getPaymentSession(input) {
      return await resolveProvider(input.provider).getPaymentSession({
        sessionId: input.sessionId,
      });
    },
    async getPaymentEvent(input) {
      return await resolveProvider(input.provider).getPaymentEvent({
        req: input.req,
      });
    },
  } satisfies PaymentService;
}
