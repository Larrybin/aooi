import 'server-only';

import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';

import type {
  CheckoutSession,
  PaymentEvent,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from '@/core/payment/domain';

export class PaymentManager {
  private readonly registry = new ProviderRegistry<PaymentProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  private resolveProvider(provider?: string): PaymentProvider {
    if (provider) {
      const providerInstance = this.getProvider(provider);
      if (!providerInstance) {
        throw new BadRequestError(`Payment provider '${provider}' not found`);
      }
      return providerInstance;
    }

    const defaultProvider = this.getDefaultProvider();
    if (!defaultProvider) {
      throw new ServiceUnavailableError('No payment provider configured');
    }

    return defaultProvider;
  }

  hasProvider(name: string): boolean {
    return this.registry.has(name);
  }

  addProvider(provider: PaymentProvider, isDefault = false) {
    const name = trimmedProviderNameKey(provider?.name);
    if (!name) {
      throw new ServiceUnavailableError('Payment provider name is required');
    }
    if (this.registry.has(name)) {
      throw new ServiceUnavailableError(
        `Payment provider '${name}' is already registered`
      );
    }
    this.registry.add(provider, isDefault);
  }

  removeProvider(name: string): boolean {
    return this.registry.remove(name);
  }

  clearProviders(): void {
    this.registry.clear();
  }

  setDefaultProvider(name: string): void {
    if (!this.registry.setDefault(name)) {
      throw new ServiceUnavailableError(`Payment provider '${name}' not found`);
    }
  }

  getProvider(name: string): PaymentProvider | undefined {
    return this.registry.get(name);
  }

  getProviderNames(): string[] {
    return this.registry.getProviderNames();
  }

  getDefaultProvider(): PaymentProvider | undefined {
    return this.registry.getDefault();
  }

  async createPayment({
    order,
    provider,
  }: {
    order: PaymentOrder;
    provider?: string;
  }): Promise<CheckoutSession> {
    return this.resolveProvider(provider).createPayment({ order });
  }

  async getPaymentSession({
    sessionId,
    provider,
  }: {
    sessionId: string;
    provider?: string;
  }): Promise<PaymentSession> {
    return this.resolveProvider(provider).getPaymentSession({ sessionId });
  }

  async getPaymentEvent({
    req,
    provider,
  }: {
    req: Request;
    provider?: string;
  }): Promise<PaymentEvent> {
    return this.resolveProvider(provider).getPaymentEvent({ req });
  }
}
