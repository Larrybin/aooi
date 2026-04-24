import 'server-only';

import type {
  CheckoutSession,
  PaymentEvent,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from '@/domains/billing/domain/payment';
import { parseStripePaymentMethodsConfig } from '@/domains/billing/domain/payment-config';
import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';

import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import { isProductionEnv } from '@/shared/lib/env';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';

const log = createUseCaseLogger({
  domain: 'billing',
  useCase: 'payment-adapter-service',
});

type PaymentServiceInput = {
  settings: BillingRuntimeSettings;
  bindings: PaymentRuntimeBindings;
};

function assertStructuredPaymentInput(
  input: unknown
): asserts input is PaymentServiceInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('settings' in input) ||
    !('bindings' in input) ||
    Object.keys(input as Record<string, unknown>).some(
      (key) => key !== 'settings' && key !== 'bindings'
    )
  ) {
    throw new Error('Payment service requires structured settings + bindings');
  }
}

async function addStripeProvider(
  registry: ProviderRegistry<PaymentProvider>,
  input: PaymentServiceInput
) {
  const { StripeProvider } = await import('@/infra/adapters/payment/stripe');
  const { settings, bindings } = input;
  const isProduction = isProductionEnv();

  if (isProduction && !bindings.stripeSigningSecret.trim()) {
    throw new ServiceUnavailableError(
      'stripe_signing_secret is required in production'
    );
  }

  let allowedPaymentMethods = ['card'];
  const stripePaymentMethodsConfig = settings.stripePaymentMethods;

  if (stripePaymentMethodsConfig) {
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

  registry.addUnique(
    new StripeProvider({
      secretKey: bindings.stripeSecretKey,
      publishableKey: bindings.stripePublishableKey,
      signingSecret: bindings.stripeSigningSecret,
      allowedPaymentMethods,
    }),
    {
      isDefault: settings.defaultPaymentProvider === 'stripe',
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
  input: PaymentServiceInput
) {
  const { CreemProvider } = await import('@/infra/adapters/payment/creem');
  const { settings, bindings } = input;

  registry.addUnique(
    new CreemProvider({
      apiKey: bindings.creemApiKey,
      environment: settings.creemEnvironment,
      signingSecret: bindings.creemSigningSecret,
    }),
    {
      isDefault: settings.defaultPaymentProvider === 'creem',
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
  input: PaymentServiceInput
) {
  const { PayPalProvider } = await import('@/infra/adapters/payment/paypal');
  const { settings, bindings } = input;

  registry.addUnique(
    new PayPalProvider({
      clientId: bindings.paypalClientId,
      clientSecret: bindings.paypalClientSecret,
      webhookId: bindings.paypalWebhookId,
      environment: settings.paypalEnvironment,
    }),
    {
      isDefault: settings.defaultPaymentProvider === 'paypal',
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

export async function getPaymentService(
  input: PaymentServiceInput
): Promise<PaymentService> {
  assertStructuredPaymentInput(input);

  const registry = new ProviderRegistry<PaymentProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  if (input.settings.stripeEnabled) {
    await addStripeProvider(registry, input);
  }

  if (input.settings.creemEnabled) {
    await addCreemProvider(registry, input);
  }

  if (input.settings.paypalEnabled) {
    await addPayPalProvider(registry, input);
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
    async createPayment(nextInput) {
      return await resolveProvider(nextInput.provider).createPayment({
        order: nextInput.order,
      });
    },
    async getPaymentSession(nextInput) {
      return await resolveProvider(nextInput.provider).getPaymentSession({
        sessionId: nextInput.sessionId,
      });
    },
    async getPaymentEvent(nextInput) {
      return await resolveProvider(nextInput.provider).getPaymentEvent({
        req: nextInput.req,
      });
    },
  } satisfies PaymentService;
}
