import {
  assertPaymentCapabilityEnabled,
  assertPaymentProviderMatchesSite,
  type ActivePaymentCapability,
} from '@/config/payment-capability';

export function requirePaymentCapability(): ActivePaymentCapability {
  return assertPaymentCapabilityEnabled();
}

export function requirePaymentProviderForSite(
  provider: string
): ActivePaymentCapability {
  return assertPaymentProviderMatchesSite(provider);
}
