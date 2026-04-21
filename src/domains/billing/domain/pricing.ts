import type {
  Pricing,
  PricingCurrency,
  PricingItem,
} from '@/shared/types/blocks/pricing';

import { PaymentInterval, PaymentType } from './payment';

export function findPricingItemByProductId(
  pricing: Pricing,
  productId: string
): PricingItem | undefined {
  const items = pricing.items ?? [];
  return items.find((item) => item.product_id === productId);
}

export type CheckoutPricingContext = {
  defaultCurrency: string;
  checkoutCurrency: string;
  checkoutAmount: number;
  selectedCurrency?: PricingCurrency;
  allowedProviders?: string[];
  paymentProductId?: string;
};

function normalizeCurrencyCode(currency: string | null | undefined): string {
  return (currency || '').trim().toLowerCase();
}

function normalizeOptionalString(
  value: string | null | undefined
): string | undefined {
  const normalized = (value || '').trim();
  return normalized ? normalized : undefined;
}

export function resolveCheckoutPricingContext({
  pricingItem,
  currency,
}: {
  pricingItem: PricingItem;
  currency: string | null | undefined;
}): CheckoutPricingContext {
  const defaultCurrency = normalizeCurrencyCode(pricingItem.currency || 'usd');
  const requestedCurrency = normalizeCurrencyCode(currency);

  const selectedCurrency =
    requestedCurrency && requestedCurrency !== defaultCurrency
      ? pricingItem.currencies?.find(
          (c) => normalizeCurrencyCode(c.currency) === requestedCurrency
        )
      : undefined;

  const checkoutCurrency = selectedCurrency
    ? requestedCurrency
    : defaultCurrency;
  const checkoutAmount = selectedCurrency
    ? selectedCurrency.amount
    : pricingItem.amount;

  const allowedProviders =
    selectedCurrency?.payment_providers &&
    selectedCurrency.payment_providers.length > 0
      ? selectedCurrency.payment_providers
      : pricingItem.payment_providers;

  const paymentProductId =
    normalizeOptionalString(selectedCurrency?.payment_product_id) ??
    normalizeOptionalString(pricingItem.payment_product_id);

  return {
    defaultCurrency,
    checkoutCurrency,
    checkoutAmount,
    selectedCurrency,
    allowedProviders,
    paymentProductId,
  };
}

export function assertPaymentProviderAllowedForCheckout({
  provider,
  pricingContext,
}: {
  provider: string;
  pricingContext: Pick<CheckoutPricingContext, 'allowedProviders'>;
}): boolean {
  const allowedProviders = pricingContext.allowedProviders;
  if (!allowedProviders || allowedProviders.length === 0) {
    return true;
  }

  return allowedProviders.includes(provider);
}

export function resolvePricingPaymentInterval(
  interval: PricingItem['interval']
): PaymentInterval {
  return (interval || PaymentInterval.ONE_TIME) as PaymentInterval;
}

export function resolvePaymentTypeFromInterval(
  interval: PaymentInterval
): PaymentType {
  return interval === PaymentInterval.ONE_TIME
    ? PaymentType.ONE_TIME
    : PaymentType.SUBSCRIPTION;
}

export function resolveSubscriptionPlanName(pricingItem: PricingItem): string {
  return (
    pricingItem.plan_name ||
    pricingItem.product_name ||
    pricingItem.title ||
    'subscription'
  );
}
