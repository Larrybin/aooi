import 'server-only';

import { defaultLocale, locales, type Locale } from '@/config/locale';
import {
  PaymentType,
  type CheckoutInfo,
  type PaymentInterval,
  type PaymentOrder,
  type PaymentPrice,
} from '@/domains/billing/domain/payment';
import { getPaymentServiceWithConfigs } from '@/infra/adapters/payment/service';
import {
  BadRequestError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnprocessableEntityError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import {
  createOrder,
  OrderStatus,
  updateOrderByOrderNo,
  type NewOrder,
} from '@/domains/billing/infra/order';
import { resolveCreemPaymentProductId } from '@/domains/billing/domain/payment-config';
import type { PricingItem } from '@/shared/types/blocks/pricing';

import {
  assertPaymentProviderAllowedForCheckout,
  resolveCheckoutPricingContext,
  resolvePaymentTypeFromInterval,
  resolvePricingPaymentInterval,
  resolveSubscriptionPlanName,
} from '@/domains/billing/domain/pricing';

type PaymentRuntimeSettings = Record<string, string | undefined>;

type LogLike = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

function normalizeLocaleValue(
  value: string | null | undefined
): Locale | undefined {
  const normalized = (value || '').trim();
  if (!normalized) return undefined;
  const candidate = normalized === 'zh-CN' ? 'zh' : normalized;
  return locales.includes(candidate as Locale)
    ? (candidate as Locale)
    : undefined;
}

function assertAppUrlOrigin(appUrl: string): string {
  const trimmed = (appUrl || '').trim();
  if (!trimmed) {
    throw new ServiceUnavailableError('app_url is not configured');
  }

  let origin: string;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('app_url must use http or https');
    }
    origin = url.origin;
  } catch (error) {
    throw new ServiceUnavailableError('invalid app_url configuration', {
      error,
    });
  }

  return origin;
}

function resolvePaymentProviderName({
  requestedProvider,
  configs,
  log,
}: {
  requestedProvider: string | null | undefined;
  configs: PaymentRuntimeSettings;
  log: LogLike;
}): string {
  const provider =
    (requestedProvider || '').trim() || configs.default_payment_provider;
  if (!provider) {
    log.error('payment: no payment provider configured', {
      defaultPaymentProvider: configs.default_payment_provider,
    });
    throw new ServiceUnavailableError('payment provider not configured');
  }
  return provider;
}

async function getPaymentProductIdFromProviderConfig({
  productId,
  provider,
  checkoutCurrency,
  configs,
  log,
}: {
  productId: string;
  provider: string;
  checkoutCurrency: string;
  configs: PaymentRuntimeSettings;
  log: LogLike;
}): Promise<string | undefined> {
  if (provider !== 'creem') {
    return;
  }

  try {
    const resolved = resolveCreemPaymentProductId({
      configValue: configs.creem_product_ids,
      productId,
      checkoutCurrency,
    });
    if (!resolved.ok) {
      log.warn('payment: invalid creem_product_ids config', {
        error: resolved.error,
        length: resolved.configLength,
      });
      throw new UnprocessableEntityError(
        'invalid payment configuration: creem_product_ids must be a JSON object'
      );
    }

    return resolved.paymentProductId;
  } catch (e: unknown) {
    if (e instanceof UnprocessableEntityError) {
      throw e;
    }
    log.error('payment: get payment product id failed', {
      provider,
      productId,
      checkoutCurrency,
      error: e,
    });
    return;
  }
}

function buildCallbackUrl({
  configs,
  locale,
  paymentType,
}: {
  configs: PaymentRuntimeSettings;
  locale: string | null | undefined;
  paymentType: PaymentType;
}): { callbackUrl: string; callbackBaseUrl: string } {
  const appUrl = assertAppUrlOrigin(configs.app_url ?? '');
  const activeLocale =
    normalizeLocaleValue(locale) ??
    normalizeLocaleValue(configs.locale) ??
    normalizeLocaleValue(configs.default_locale);

  let callbackBaseUrl = appUrl;
  if (activeLocale && activeLocale !== defaultLocale) {
    callbackBaseUrl += `/${activeLocale}`;
  }

  const callbackUrl =
    paymentType === PaymentType.SUBSCRIPTION
      ? `${callbackBaseUrl}/settings/billing`
      : `${callbackBaseUrl}/settings/payments`;

  return { callbackUrl, callbackBaseUrl };
}

function buildCheckoutOrder({
  pricingItem,
  user,
  paymentType,
  paymentInterval,
  orderNo,
  configs,
  callbackUrl,
  callbackBaseUrl,
  metadata,
  paymentProductId,
  checkoutPrice,
}: {
  pricingItem: PricingItem;
  user: { id: string; email: string; name?: string | null };
  paymentType: PaymentType;
  paymentInterval: PaymentInterval;
  orderNo: string;
  configs: PaymentRuntimeSettings;
  callbackUrl: string;
  callbackBaseUrl: string;
  metadata: Record<string, unknown> | null | undefined;
  paymentProductId: string;
  checkoutPrice: PaymentPrice;
}): PaymentOrder {
  const checkoutOrder: PaymentOrder = {
    description: pricingItem.product_name,
    customer: {
      name: user.name || undefined,
      email: user.email,
    },
    type: paymentType,
    metadata: {
      ...(metadata || {}),
      app_name: configs.app_name,
      order_no: orderNo,
      user_id: user.id,
    },
    successUrl: (() => {
      try {
        const url = new URL(callbackUrl);
        url.searchParams.set('order_no', orderNo);
        return url.toString();
      } catch {
        return callbackUrl;
      }
    })(),
    cancelUrl: `${callbackBaseUrl}/pricing`,
  };

  if (paymentProductId) {
    checkoutOrder.productId = paymentProductId;
  }

  checkoutOrder.price = checkoutPrice;

  if (paymentType === PaymentType.SUBSCRIPTION) {
    checkoutOrder.plan = {
      interval: paymentInterval,
      name: resolveSubscriptionPlanName(pricingItem),
    };
  }

  return checkoutOrder;
}

function buildPendingOrder({
  orderId,
  orderNo,
  pricingItem,
  user,
  providerName,
  pricingContext,
  paymentType,
  paymentInterval,
  paymentProductId,
  callbackUrl,
  checkoutOrder,
  currentTime,
}: {
  orderId: string;
  orderNo: string;
  pricingItem: PricingItem;
  user: { id: string; email: string };
  providerName: string;
  pricingContext: ReturnType<typeof resolveCheckoutPricingContext>;
  paymentType: PaymentType;
  paymentInterval: PaymentInterval;
  paymentProductId: string;
  callbackUrl: string;
  checkoutOrder: PaymentOrder;
  currentTime: Date;
}): NewOrder {
  return {
    id: orderId,
    orderNo,
    userId: user.id,
    userEmail: user.email,
    status: OrderStatus.PENDING,
    amount: pricingContext.checkoutAmount,
    currency: pricingContext.checkoutCurrency,
    productId: pricingItem.product_id,
    paymentType,
    paymentInterval,
    paymentProvider: providerName,
    checkoutInfo: JSON.stringify(checkoutOrder),
    createdAt: currentTime,
    productName: pricingItem.product_name,
    description: pricingItem.description,
    callbackUrl,
    creditsAmount: pricingItem.credits,
    creditsValidDays: pricingItem.valid_days,
    planName: pricingItem.plan_name || '',
    paymentProductId,
  };
}

export async function createPaymentCheckoutSession({
  pricingItem,
  user,
  configs,
  currency,
  locale,
  paymentProvider,
  metadata,
  log,
}: {
  pricingItem: PricingItem;
  user: { id: string; email?: string | null; name?: string | null };
  configs: PaymentRuntimeSettings;
  currency: string | null | undefined;
  locale: string | null | undefined;
  paymentProvider: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
  log: LogLike;
}): Promise<CheckoutInfo> {
  if (!user.email) {
    throw new UnauthorizedError('no auth, please sign in');
  }

  const paymentProviderName = resolvePaymentProviderName({
    requestedProvider: paymentProvider,
    configs,
    log,
  });

  const pricingContext = resolveCheckoutPricingContext({
    pricingItem,
    currency,
  });

  if (
    !assertPaymentProviderAllowedForCheckout({
      provider: paymentProviderName,
      pricingContext,
    })
  ) {
    throw new BadRequestError(
      `payment provider ${paymentProviderName} is not supported for this currency`
    );
  }

  const paymentInterval = resolvePricingPaymentInterval(pricingItem.interval);
  const paymentType = resolvePaymentTypeFromInterval(paymentInterval);

  const orderNo = getSnowId();

  let paymentProductId = (pricingContext.paymentProductId || '').trim();
  if (!paymentProductId) {
    paymentProductId =
      (await getPaymentProductIdFromProviderConfig({
        productId: pricingItem.product_id,
        provider: paymentProviderName,
        checkoutCurrency: pricingContext.checkoutCurrency,
        configs,
        log,
      })) || '';
    paymentProductId = paymentProductId.trim();
  }

  const checkoutPrice: PaymentPrice = {
    amount: pricingContext.checkoutAmount,
    currency: pricingContext.checkoutCurrency,
  };

  if (!paymentProductId) {
    if (!checkoutPrice.amount || !checkoutPrice.currency) {
      throw new BadRequestError('invalid checkout price');
    }
  }

  const { callbackUrl, callbackBaseUrl } = buildCallbackUrl({
    configs,
    locale,
    paymentType,
  });

  const checkoutOrder = buildCheckoutOrder({
    pricingItem,
    user: { id: user.id, email: user.email, name: user.name },
    paymentType,
    paymentInterval,
    orderNo,
    configs,
    callbackUrl,
    callbackBaseUrl,
    metadata,
    paymentProductId,
    checkoutPrice,
  });

  const currentTime = new Date();
  const orderId = getUuid();

  const order: NewOrder = buildPendingOrder({
    orderId,
    orderNo,
    pricingItem,
    user: { id: user.id, email: user.email },
    providerName: paymentProviderName,
    pricingContext,
    paymentType,
    paymentInterval,
    paymentProductId,
    callbackUrl,
    checkoutOrder,
    currentTime,
  });

  const paymentService = await getPaymentServiceWithConfigs(configs);

  await createOrder(order);

  try {
    const result = await paymentService.createPayment({
      provider: paymentProviderName,
      order: checkoutOrder,
    });

    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.CREATED,
      checkoutInfo: JSON.stringify(result.checkoutParams),
      checkoutResult: JSON.stringify(result.checkoutResult),
      checkoutUrl: result.checkoutInfo.checkoutUrl,
      paymentSessionId: result.checkoutInfo.sessionId,
      paymentProvider: result.provider,
    });

    return result.checkoutInfo;
  } catch (e: unknown) {
    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.COMPLETED,
      checkoutInfo: JSON.stringify(checkoutOrder),
    });

    log.error('payment: checkout failed', {
      orderNo,
      paymentProviderName,
      paymentProvider: paymentProviderName,
      productId: pricingItem.product_id,
      currency: pricingContext.checkoutCurrency,
      error: e,
    });

    throw new UpstreamError(502, 'checkout failed');
  }
}
