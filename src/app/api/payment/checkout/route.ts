import { createApiContext } from '@/app/api/_lib/context';
import { createPaymentCheckoutSession } from '@/domains/billing/application/checkout';
import { findPricingItemByProductId } from '@/domains/billing/domain/pricing';
import { readBillingRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import { getTranslations } from 'next-intl/server';

import { BadRequestError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { PaymentCheckoutBodySchema } from '@/shared/schemas/api/payment/checkout';
import type { Pricing } from '@/shared/types/blocks/pricing';

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const { product_id, currency, locale, payment_provider, metadata } =
    await api.parseJson(PaymentCheckoutBodySchema);

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

  const user = await api.requireUser();

  const [settings, bindings] = await Promise.all([
    readBillingRuntimeSettingsCached(),
    Promise.resolve(getPaymentRuntimeBindings()),
  ]);

  const checkoutInfo = await createPaymentCheckoutSession({
    pricingItem,
    user,
    settings,
    bindings,
    currency,
    locale,
    paymentProvider: payment_provider,
    metadata,
    log,
  });

  return jsonOk(checkoutInfo);
});
