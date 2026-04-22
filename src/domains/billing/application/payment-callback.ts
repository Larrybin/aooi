import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { site } from '@/site';
import { PaymentType, type PaymentSession } from '@/domains/billing/domain/payment';
import type { Order, findOrderByOrderNo } from '@/domains/billing/infra/order';
import type {
  readRuntimeSettingsCached,
  readRuntimeSettingsFresh,
} from '@/domains/settings/application/settings-runtime.query';
import type { getPaymentServiceWithConfigs } from '@/infra/adapters/payment/service';
import type { handleCheckoutSuccess } from '@/domains/billing/application/flows';

type BillingCallbackLog = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

type PaymentCallbackDeps = {
  readRuntimeSettingsCached: typeof readRuntimeSettingsCached;
  readRuntimeSettingsFresh: typeof readRuntimeSettingsFresh;
  findOrderByOrderNo: typeof findOrderByOrderNo;
  getPaymentServiceWithConfigs: typeof getPaymentServiceWithConfigs;
  handleCheckoutSuccess: typeof handleCheckoutSuccess;
};

export async function resolvePaymentCallbackRedirectQuery(
  input: {
    orderNo: string;
    actorUserId: string;
    log: BillingCallbackLog;
  },
  deps?: Pick<
    PaymentCallbackDeps,
    'readRuntimeSettingsCached' | 'findOrderByOrderNo'
  >
) {
  const resolvedDeps = deps ?? (await getPaymentCallbackReadDeps());
  const appUrl = await resolveAppUrl(resolvedDeps);

  try {
    const order = await resolvedDeps.findOrderByOrderNo(input.orderNo);
    assertOrderVisibleToActor(order, input.actorUserId, 'order and user not match');

    const base = order.callbackUrl || toPaymentFallbackUrl(order.paymentType, appUrl);
    return appendOrderNoToUrl(base, input.orderNo, appUrl);
  } catch (error: unknown) {
    input.log.error('payment: checkout callback failed', { error });
    return toPricingFallbackUrl(appUrl);
  }
}

export async function resolvePaymentCallbackPricingFallbackUrl(
  deps?: Pick<PaymentCallbackDeps, 'readRuntimeSettingsCached'>
) {
  try {
    const resolvedDeps = deps ?? (await getPaymentCallbackPricingDeps());
    const appUrl = await resolveAppUrl(resolvedDeps);
    return toPricingFallbackUrl(appUrl);
  } catch {
    return '/pricing';
  }
}

async function getPaymentCallbackReadDeps(): Promise<
  Pick<
    PaymentCallbackDeps,
    'readRuntimeSettingsCached' | 'findOrderByOrderNo'
  >
> {
  const [settingsModule, orderModule] = await Promise.all([
    import('@/domains/settings/application/settings-runtime.query'),
    import('@/domains/billing/infra/order'),
  ]);

  return {
    readRuntimeSettingsCached: settingsModule.readRuntimeSettingsCached,
    findOrderByOrderNo: orderModule.findOrderByOrderNo,
  };
}

async function getPaymentCallbackPricingDeps(): Promise<
  Pick<PaymentCallbackDeps, 'readRuntimeSettingsCached'>
> {
  const settingsModule = await import('@/domains/settings/application/settings-runtime.query');

  return {
    readRuntimeSettingsCached: settingsModule.readRuntimeSettingsCached,
  };
}

export async function confirmPaymentCallbackUseCase(
  input: {
    orderNo: string;
    actorUserId: string;
    actorUserEmail?: string | null;
    mode?: 'fresh' | 'cached';
    log: BillingCallbackLog;
  },
  deps?: PaymentCallbackDeps
) {
  const resolvedDeps = deps ?? (await getPaymentCallbackDeps());
  if (!input.actorUserEmail) {
    throw new UnauthorizedError('no auth, please sign in');
  }

  const appUrl = await resolveAppUrl(resolvedDeps);
  const order = await resolvedDeps.findOrderByOrderNo(input.orderNo);
  assertOrderVisibleToActor(order, input.actorUserId, 'no permission');

  if (!order.paymentSessionId || !order.paymentProvider) {
    throw new BadRequestError('invalid order');
  }

  const paymentService = await resolvedDeps.getPaymentServiceWithConfigs(
    input.mode === 'fresh'
      ? await resolvedDeps.readRuntimeSettingsFresh()
      : await resolvedDeps.readRuntimeSettingsCached()
  );
  const session: PaymentSession = await paymentService.getPaymentSession({
    provider: order.paymentProvider,
    sessionId: order.paymentSessionId,
  });

  await resolvedDeps.handleCheckoutSuccess({
    order,
    session,
    log: input.log,
  });

  return {
    orderNo: input.orderNo,
    redirectUrl: order.callbackUrl || toPaymentFallbackUrl(order.paymentType, appUrl),
  };
}

async function resolveAppUrl(
  _deps: Pick<PaymentCallbackDeps, 'readRuntimeSettingsCached'>
) {
  return site.brand.appUrl;
}

function appendOrderNoToUrl(url: string, orderNo: string, appUrl: string): string {
  try {
    const full = new URL(url, appUrl);
    full.searchParams.set('order_no', orderNo);
    return full.toString();
  } catch {
    return url;
  }
}

function toPaymentFallbackUrl(type: string | null | undefined, appUrl: string): string {
  return type === PaymentType.SUBSCRIPTION
    ? `${appUrl}/settings/billing`
    : `${appUrl}/settings/payments`;
}

function toPricingFallbackUrl(appUrl: string): string {
  return `${appUrl}/pricing`;
}

function assertOrderVisibleToActor(
  order: Order | undefined,
  actorUserId: string,
  forbiddenMessage: string
): asserts order is Order {
  if (!order) {
    throw new NotFoundError('order not found');
  }
  if (order.userId !== actorUserId) {
    throw new ForbiddenError(forbiddenMessage);
  }
}

async function getPaymentCallbackDeps(): Promise<PaymentCallbackDeps> {
  const [settingsModule, orderModule, paymentServiceModule, flowsModule] =
    await Promise.all([
      import('@/domains/settings/application/settings-runtime.query'),
      import('@/domains/billing/infra/order'),
      import('@/infra/adapters/payment/service'),
      import('@/domains/billing/application/flows'),
    ]);

  return {
    readRuntimeSettingsCached: settingsModule.readRuntimeSettingsCached,
    readRuntimeSettingsFresh: settingsModule.readRuntimeSettingsFresh,
    findOrderByOrderNo: orderModule.findOrderByOrderNo,
    getPaymentServiceWithConfigs: paymentServiceModule.getPaymentServiceWithConfigs,
    handleCheckoutSuccess: flowsModule.handleCheckoutSuccess,
  };
}
