import { getTranslations } from 'next-intl/server';

import {
  PaymentInterval,
  PaymentType,
  type PaymentOrder,
  type PaymentPrice,
} from '@/extensions/payment';
import {
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnprocessableEntityError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { requireUser } from '@/shared/lib/api/guard';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import {
  getRequestLogger,
  type RequestLogger,
} from '@/shared/lib/request-logger.server';
import { getAllConfigs } from '@/shared/models/config';
import {
  createOrder,
  OrderStatus,
  updateOrderByOrderNo,
  type NewOrder,
} from '@/shared/models/order';
import { PaymentCheckoutBodySchema } from '@/shared/schemas/api/payment/checkout';
import { getPaymentService } from '@/shared/services/payment';
import { parseCreemProductIdsMappingConfig } from '@/shared/services/settings/validators/payment';
import type { Pricing, PricingCurrency } from '@/shared/types/blocks/pricing';

export const POST = withApi(async (req: Request) => {
  const { log } = getRequestLogger(req);
  const { product_id, currency, locale, payment_provider, metadata } =
    await parseJson(req, PaymentCheckoutBodySchema);

  const t = await getTranslations({
    locale: locale || 'en',
    namespace: 'pricing',
  });
  const pricing = t.raw('pricing') as Pricing;
  const pricingItems = pricing.items ?? [];

  const pricingItem = pricingItems.find(
    (item) => item.product_id === product_id
  );

  if (!pricingItem) {
    throw new NotFoundError('pricing item not found');
  }

  if (!pricingItem.product_id && !pricingItem.amount) {
    throw new BadRequestError('invalid pricing item');
  }

  const user = await requireUser(req);
  if (!user.email) {
    throw new UnauthorizedError('no auth, please sign in');
  }

  // get configs
  const configs = await getAllConfigs();

  // choose payment provider
  let paymentProviderName = payment_provider || '';
  if (!paymentProviderName) {
    paymentProviderName = configs.default_payment_provider;
  }
  if (!paymentProviderName) {
    log.error('payment: no payment provider configured', {
      defaultPaymentProvider: configs.default_payment_provider,
    });
    throw new ServiceUnavailableError('payment provider not configured');
  }

  // Validate payment provider against allowed providers
  // First check currency-specific payment_providers if currency is provided
  let allowedProviders: string[] | undefined;

  if (
    currency &&
    currency.toLowerCase() !== (pricingItem.currency || 'usd').toLowerCase()
  ) {
    const selectedCurrencyData = pricingItem.currencies?.find(
      (c: PricingCurrency) =>
        c.currency.toLowerCase() === currency.toLowerCase()
    );
    allowedProviders = selectedCurrencyData?.payment_providers;
  }

  // Fallback to default payment_providers if not found in currency config
  if (!allowedProviders || allowedProviders.length === 0) {
    allowedProviders = pricingItem.payment_providers;
  }

  // If payment_providers is configured, validate the selected provider
  if (allowedProviders && allowedProviders.length > 0) {
    if (!allowedProviders.includes(paymentProviderName)) {
      throw new BadRequestError(
        `payment provider ${paymentProviderName} is not supported for this currency`
      );
    }
  }

  // get default payment provider
  const paymentService = await getPaymentService();

  const paymentProvider = paymentService.getProvider(paymentProviderName);
  if (!paymentProvider || !paymentProvider.name) {
    log.error('payment: payment provider unavailable', {
      paymentProviderName,
    });
    throw new ServiceUnavailableError('payment provider not configured');
  }

  // checkout currency and amount - calculate from server-side data only (never trust client input)
  // Security: currency can be provided by frontend, but amount must be calculated server-side
  const defaultCurrency = (pricingItem.currency || 'usd').toLowerCase();
  let checkoutCurrency = defaultCurrency;
  let checkoutAmount = pricingItem.amount;

  // If currency is provided, validate it and find corresponding amount from server-side data
  if (currency) {
    const requestedCurrency = currency.toLowerCase();

    // Check if requested currency is the default currency
    if (requestedCurrency === defaultCurrency) {
      checkoutCurrency = defaultCurrency;
      checkoutAmount = pricingItem.amount;
    } else if (pricingItem.currencies && pricingItem.currencies.length > 0) {
      // Find amount for the requested currency in currencies list
      const selectedCurrencyData = pricingItem.currencies.find(
        (c: PricingCurrency) => c.currency.toLowerCase() === requestedCurrency
      );
      if (selectedCurrencyData) {
        // Valid currency found, use it
        checkoutCurrency = requestedCurrency;
        checkoutAmount = selectedCurrencyData.amount;
      }
      // If currency not found in list, fallback to default (already set above)
    }
    // If no currencies list exists, fallback to default (already set above)
  }

  // get payment interval
  const paymentInterval: PaymentInterval =
    pricingItem.interval || PaymentInterval.ONE_TIME;

  // get payment type
  const paymentType =
    paymentInterval === PaymentInterval.ONE_TIME
      ? PaymentType.ONE_TIME
      : PaymentType.SUBSCRIPTION;

  const orderNo = getSnowId();

  // get payment product id from pricing table in local file
  // First try to get currency-specific payment_product_id
  let paymentProductId = '';

  // If currency is provided and different from default, check currency-specific payment_product_id
  if (currency && currency.toLowerCase() !== defaultCurrency) {
    const selectedCurrencyData = pricingItem.currencies?.find(
      (c: PricingCurrency) =>
        c.currency.toLowerCase() === currency.toLowerCase()
    );
    if (selectedCurrencyData?.payment_product_id) {
      paymentProductId = selectedCurrencyData.payment_product_id;
    }
  }

  // Fallback to default payment_product_id if not found in currency config
  if (!paymentProductId) {
    paymentProductId = pricingItem.payment_product_id || '';
  }

  // If still not found, get from payment provider's config
  if (!paymentProductId) {
    paymentProductId =
      (await getPaymentProductId(
        pricingItem.product_id,
        paymentProviderName,
        checkoutCurrency,
        log
      )) || '';
  }

  // build checkout price with correct amount for selected currency
  const checkoutPrice: PaymentPrice = {
    amount: checkoutAmount,
    currency: checkoutCurrency,
  };

  if (!paymentProductId) {
    // checkout price validation
    if (!checkoutPrice.amount || !checkoutPrice.currency) {
      throw new BadRequestError('invalid checkout price');
    }
  } else {
    paymentProductId = paymentProductId.trim();
  }

  let callbackBaseUrl = `${configs.app_url}`;
  if (locale && locale !== configs.default_locale) {
    callbackBaseUrl += `/${locale}`;
  }

  const callbackUrl =
    paymentType === PaymentType.SUBSCRIPTION
      ? `${callbackBaseUrl}/settings/billing`
      : `${callbackBaseUrl}/settings/payments`;

  // build checkout order
  const checkoutOrder: PaymentOrder = {
    description: pricingItem.product_name,
    customer: {
      name: user.name,
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

  // checkout with predefined product
  if (paymentProductId) {
    checkoutOrder.productId = paymentProductId;
  }

  // checkout dynamically
  checkoutOrder.price = checkoutPrice;
  if (paymentType === PaymentType.SUBSCRIPTION) {
    // subscription mode
    const planName =
      pricingItem.plan_name ||
      pricingItem.product_name ||
      pricingItem.title ||
      'subscription';
    checkoutOrder.plan = {
      interval: paymentInterval,
      name: planName,
    };
  } else {
    // one-time mode
  }

  const currentTime = new Date();

  // build order info
  const order: NewOrder = {
    id: getUuid(),
    orderNo: orderNo,
    userId: user.id,
    userEmail: user.email,
    status: OrderStatus.PENDING,
    amount: checkoutAmount, // use the amount for selected currency
    currency: checkoutCurrency,
    productId: pricingItem.product_id,
    paymentType: paymentType,
    paymentInterval: paymentInterval,
    paymentProvider: paymentProvider.name,
    checkoutInfo: JSON.stringify(checkoutOrder),
    createdAt: currentTime,
    productName: pricingItem.product_name,
    description: pricingItem.description,
    callbackUrl: callbackUrl,
    creditsAmount: pricingItem.credits,
    creditsValidDays: pricingItem.valid_days,
    planName: pricingItem.plan_name || '',
    paymentProductId: paymentProductId,
  };

  // create order
  await createOrder(order);

  try {
    // create payment
    const result = await paymentProvider.createPayment({
      order: checkoutOrder,
    });

    // update order status to created, waiting for payment
    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.CREATED, // means checkout created, waiting for payment
      checkoutInfo: JSON.stringify(result.checkoutParams),
      checkoutResult: JSON.stringify(result.checkoutResult),
      checkoutUrl: result.checkoutInfo.checkoutUrl,
      paymentSessionId: result.checkoutInfo.sessionId,
      paymentProvider: result.provider,
    });

    return jsonOk(result.checkoutInfo);
  } catch (e: unknown) {
    // update order status to completed, means checkout failed
    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.COMPLETED, // means checkout failed
      checkoutInfo: JSON.stringify(checkoutOrder),
    });

    log.error('payment: checkout failed', {
      orderNo,
      paymentProviderName,
      paymentProvider: paymentProvider.name,
      productId: pricingItem.product_id,
      currency: checkoutCurrency,
      error: e,
    });

    throw new UpstreamError(502, 'checkout failed');
  }
});

// get payemt product id from payment provider's config
async function getPaymentProductId(
  productId: string,
  provider: string,
  checkoutCurrency: string,
  log: RequestLogger['log']
): Promise<string | undefined> {
  if (provider !== 'creem') {
    // currently only creem supports payment product id mapping
    return;
  }

  try {
    const configs = await getAllConfigs();
    const creemProductIds = configs.creem_product_ids;
    if (creemProductIds) {
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

      const productIds = parsed.mapping;
      return (
        productIds[`${productId}_${checkoutCurrency}`] || productIds[productId]
      );
    }
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
