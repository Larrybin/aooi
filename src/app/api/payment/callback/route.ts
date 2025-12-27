import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import { PaymentType } from '@/extensions/payment';
import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { findOrderByOrderNo } from '@/shared/models/order';
import { getAllConfigs } from '@/shared/models/config';
import {
  PaymentCallbackBodySchema,
  PaymentCallbackQuerySchema,
} from '@/shared/schemas/api/payment/callback';
import {
  getPaymentService,
  handleCheckoutSuccess,
} from '@/shared/services/payment';

function appendOrderNoToUrl(url: string, orderNo: string, appUrl: string): string {
  try {
    const full = new URL(url, appUrl);
    full.searchParams.set('order_no', orderNo);
    return full.toString();
  } catch {
    return url;
  }
}

function toPaymentFallbackUrl(
  type: string | null | undefined,
  appUrl: string
): string {
  return type === PaymentType.SUBSCRIPTION
    ? `${appUrl}/settings/billing`
    : `${appUrl}/settings/payments`;
}

export async function GET(req: Request) {
  const api = createApiContext(req);
  const { log } = api;
  let redirectUrl = '';

  const configs = await getAllConfigs();
  const appUrl = (configs.app_url || envConfigs.app_url).trim();

  try {
    // get callback params
    const { order_no: orderNo } = api.parseQuery(PaymentCallbackQuerySchema);

    // require signed-in user (GET is safe: CSRF guard only checks cookie + write requests)
    const user = await api.requireUser();

    // get order
    const order = await findOrderByOrderNo(orderNo);
    if (!order) {
      throw new NotFoundError('order not found');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenError('order and user not match');
    }

    const base =
      order.callbackUrl || toPaymentFallbackUrl(order.paymentType, appUrl);
    redirectUrl = appendOrderNoToUrl(base, orderNo, appUrl);
  } catch (e: unknown) {
    log.error('payment: checkout callback failed', { error: e });
    redirectUrl = `${appUrl}/pricing`;
  }

  redirect(redirectUrl);
}

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const { order_no: orderNo } = await api.parseJson(PaymentCallbackBodySchema);

  const configs = await getAllConfigs();
  const appUrl = (configs.app_url || envConfigs.app_url).trim();

  const user = await api.requireUser();
  if (!user.email) {
    throw new UnauthorizedError('no auth, please sign in');
  }

  const order = await findOrderByOrderNo(orderNo);
  if (!order) {
    throw new NotFoundError('order not found');
  }

  if (order.userId !== user.id) {
    throw new ForbiddenError('no permission');
  }

  if (!order.paymentSessionId || !order.paymentProvider) {
    throw new BadRequestError('invalid order');
  }

  const paymentService = await getPaymentService();
  const paymentProvider = paymentService.getProvider(order.paymentProvider);
  if (!paymentProvider) {
    throw new NotFoundError('payment provider not found');
  }

  const session = await paymentProvider.getPaymentSession({
    sessionId: order.paymentSessionId,
  });

  await handleCheckoutSuccess({
    order,
    session,
    log,
  });

  return jsonOk({
    orderNo,
    redirectUrl:
      order.callbackUrl || toPaymentFallbackUrl(order.paymentType, appUrl),
  });
});
