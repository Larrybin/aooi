import { getTranslations } from 'next-intl/server';

import { BadRequestError, NotFoundError } from '@/shared/lib/api/errors';
import { requireUser } from '@/shared/lib/api/guard';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { findPricingItemByProductId } from '@/shared/lib/payment/pricing';
import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { getAllConfigs } from '@/shared/models/config';
import { PaymentCheckoutBodySchema } from '@/shared/schemas/api/payment/checkout';
import { createPaymentCheckoutSession } from '@/shared/services/payment';
import type { Pricing } from '@/shared/types/blocks/pricing';

export const POST = withApi(async (req: Request) => {
  const { log } = getRequestLogger(req);
  const { product_id, currency, locale, payment_provider, metadata } =
    await parseJson(req, PaymentCheckoutBodySchema);

  const t = await getTranslations({
    locale: locale || 'en',
    namespace: 'pricing',
  });
  const pricing = t.raw('pricing') as Pricing;
  const pricingItem = findPricingItemByProductId(pricing, product_id);

  if (!pricingItem) {
    throw new NotFoundError('pricing item not found');
  }

  if (!pricingItem.product_id && !pricingItem.amount) {
    throw new BadRequestError('invalid pricing item');
  }

  const user = await requireUser(req);

  const configs = await getAllConfigs();

  const checkoutInfo = await createPaymentCheckoutSession({
    pricingItem,
    user,
    configs,
    currency,
    locale,
    paymentProvider: payment_provider,
    metadata,
    log,
  });

  return jsonOk(checkoutInfo);
});
