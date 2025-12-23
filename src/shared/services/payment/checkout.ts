import 'server-only';

import {
  PaymentInterval,
  PaymentType,
  type CheckoutInfo,
  type PaymentOrder,
  type PaymentPrice,
} from '@/extensions/payment';
import {
  BadRequestError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnprocessableEntityError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import { resolveCheckoutPricingContext } from '@/shared/lib/payment/pricing';
import type { Configs } from '@/shared/models/config';
import {
  createOrder,
  OrderStatus,
  updateOrderByOrderNo,
  type NewOrder,
} from '@/shared/models/order';
import { parseCreemProductIdsMappingConfig } from '@/shared/services/settings/validators/payment';
import type { PricingItem } from '@/shared/types/blocks/pricing';

import { getPaymentService } from './manager';

type LogLike = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

function resolvePaymentProviderName({
  requestedProvider,
  configs,
  log,
}: {
  requestedProvider: string | null | undefined;
  configs: Configs;
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
  configs: Configs;
  log: LogLike;
}): Promise<string | undefined> {
  if (provider !== 'creem') {
    return;
  }

  try {
    const creemProductIds = configs.creem_product_ids;
    if (!creemProductIds) {
      return;
    }

    const parsed = parseCreemProductIdsMappingConfig(creemProductIds);
    if (!parsed.ok) {
      log.warn('payment: invalid creem_product_ids config', {
        error: parsed.error,
        length: creemProductIds.length,
      });
      throw new UnprocessableEntityError(
        'invalid payment configuration: creem_product_ids must be a JSON object'
      );
    }

    const mapping = parsed.mapping;
    return mapping[`${productId}_${checkoutCurrency}`] || mapping[productId];
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
  configs: Configs;
  locale: string | null | undefined;
  paymentType: PaymentType;
}): { callbackUrl: string; callbackBaseUrl: string } {
  let callbackBaseUrl = `${configs.app_url}`;
  if (locale && locale !== configs.default_locale) {
    callbackBaseUrl += `/${locale}`;
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
  configs: Configs;
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
    const planName =
      pricingItem.plan_name ||
      pricingItem.product_name ||
      pricingItem.title ||
      'subscription';
    checkoutOrder.plan = {
      interval: paymentInterval,
      name: planName,
    };
  }

  return checkoutOrder;
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
  configs: Configs;
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

  const allowedProviders = pricingContext.allowedProviders;
  if (allowedProviders && allowedProviders.length > 0) {
    if (!allowedProviders.includes(paymentProviderName)) {
      throw new BadRequestError(
        `payment provider ${paymentProviderName} is not supported for this currency`
      );
    }
  }

  const paymentService = await getPaymentService();
  const provider = paymentService.getProvider(paymentProviderName);
  if (!provider || !provider.name) {
    log.error('payment: payment provider unavailable', {
      paymentProviderName,
    });
    throw new ServiceUnavailableError('payment provider not configured');
  }

  const paymentInterval: PaymentInterval =
    pricingItem.interval || PaymentInterval.ONE_TIME;

  const paymentType =
    paymentInterval === PaymentInterval.ONE_TIME
      ? PaymentType.ONE_TIME
      : PaymentType.SUBSCRIPTION;

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

  const order: NewOrder = {
    id: getUuid(),
    orderNo,
    userId: user.id,
    userEmail: user.email,
    status: OrderStatus.PENDING,
    amount: pricingContext.checkoutAmount,
    currency: pricingContext.checkoutCurrency,
    productId: pricingItem.product_id,
    paymentType,
    paymentInterval,
    paymentProvider: provider.name,
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

  await createOrder(order);

  try {
    const result = await provider.createPayment({
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
      paymentProvider: provider.name,
      productId: pricingItem.product_id,
      currency: pricingContext.checkoutCurrency,
      error: e,
    });

    throw new UpstreamError(502, 'checkout failed');
  }
}
