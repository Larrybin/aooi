import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import { PaymentType } from '@/extensions/payment';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { requireUser } from '@/shared/lib/api/guard';
import { parseJson, parseQuery } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { findOrderByOrderNo } from '@/shared/models/order';
import {
  PaymentCallbackBodySchema,
  PaymentCallbackQuerySchema,
} from '@/shared/schemas/api/payment/callback';
import {
  getPaymentService,
  handleCheckoutSuccess,
} from '@/shared/services/payment';

function appendOrderNoToUrl(url: string, orderNo: string): string {
  try {
    const full = new URL(url, envConfigs.app_url);
    full.searchParams.set('order_no', orderNo);
    return full.toString();
  } catch {
    return url;
  }
}

function toPaymentFallbackUrl(type: string | null | undefined): string {
  return type === PaymentType.SUBSCRIPTION
    ? `${envConfigs.app_url}/settings/billing`
    : `${envConfigs.app_url}/settings/payments`;
}

export async function GET(req: Request) {
  const { log } = getRequestLogger(req);
  let redirectUrl = '';

  try {
    // get callback params
    const { order_no: orderNo } = parseQuery(
      req.url,
      PaymentCallbackQuerySchema
    );

    // require signed-in user (GET is safe: CSRF guard only checks cookie + write requests)
    const user = await requireUser(req);

    // get order
    const order = await findOrderByOrderNo(orderNo);
    if (!order) {
      throw new NotFoundError('order not found');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenError('order and user not match');
    }

    const base = order.callbackUrl || toPaymentFallbackUrl(order.paymentType);
    redirectUrl = appendOrderNoToUrl(base, orderNo);
  } catch (e: unknown) {
    log.error('payment: checkout callback failed', { error: e });
    redirectUrl = `${envConfigs.app_url}/pricing`;
  }

  redirect(redirectUrl);
}

export const POST = withApi(async (req: Request) => {
  const { log } = getRequestLogger(req);
  const { order_no: orderNo } = await parseJson(req, PaymentCallbackBodySchema);

  const user = await requireUser(req);
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
    redirectUrl: order.callbackUrl || toPaymentFallbackUrl(order.paymentType),
  });
});
