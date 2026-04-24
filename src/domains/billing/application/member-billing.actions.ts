import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';

import type { MemberSubscriptionRow } from './member-billing.query';

function isCancelableSubscriptionStatus(status: string | null | undefined) {
  return status === 'active' || status === 'trialing';
}

export async function retrieveInvoiceUseCase(
  input: {
    orderNo: string;
    actorUserId: string;
  },
  deps: {
    findOrderByOrderNo: (orderNo: string) => Promise<
      | {
          orderNo: string;
          userId: string;
          paymentProvider?: string | null;
          invoiceId?: string | null;
        }
      | undefined
    >;
    getPaymentService: (input: {
      settings: BillingRuntimeSettings;
      bindings: PaymentRuntimeBindings;
    }) => Promise<{
      getProvider: (provider: string) =>
        | {
            getPaymentInvoice?: (input: {
              invoiceId: string;
            }) => Promise<{ invoiceUrl?: string | null } | undefined>;
          }
        | undefined;
    }>;
    readBillingRuntimeSettingsCached: () => Promise<BillingRuntimeSettings>;
    readPaymentRuntimeBindings: () => Promise<PaymentRuntimeBindings>;
    updateOrderByOrderNo: (
      orderNo: string,
      updates: {
        invoiceUrl: string;
      }
    ) => Promise<unknown>;
  }
) {
  const order = await deps.findOrderByOrderNo(input.orderNo);
  if (!order) {
    return { status: 'not_found' } as const;
  }
  if (order.userId !== input.actorUserId) {
    return { status: 'forbidden' } as const;
  }
  if (!order.paymentProvider || !order.invoiceId) {
    return { status: 'missing_invoice' } as const;
  }

  const [settings, bindings] = await Promise.all([
    deps.readBillingRuntimeSettingsCached(),
    deps.readPaymentRuntimeBindings(),
  ]);
  const paymentService = await deps.getPaymentService({
    settings,
    bindings,
  });
  const paymentProvider = paymentService.getProvider(order.paymentProvider);
  if (!paymentProvider?.getPaymentInvoice) {
    throw new ServiceUnavailableError('payment provider not found');
  }

  const invoice = await paymentProvider.getPaymentInvoice({
    invoiceId: order.invoiceId,
  });
  if (!invoice?.invoiceUrl) {
    return { status: 'missing_invoice_url' } as const;
  }

  await deps.updateOrderByOrderNo(order.orderNo, {
    invoiceUrl: invoice.invoiceUrl,
  });

  return {
    status: 'ok',
    invoiceUrl: invoice.invoiceUrl,
  } as const;
}

export async function retrieveBillingPortalUseCase(
  input: {
    subscriptionNo: string;
    actorUserId: string;
    returnUrl: string;
  },
  deps: {
    findSubscriptionBySubscriptionNo: (subscriptionNo: string) => Promise<
      | {
          subscriptionNo: string;
          userId: string;
          paymentProvider?: string | null;
          paymentUserId?: string | null;
        }
      | undefined
    >;
    getPaymentService: (input: {
      settings: BillingRuntimeSettings;
      bindings: PaymentRuntimeBindings;
    }) => Promise<{
      getProvider: (provider: string) =>
        | {
            getPaymentBilling?: (input: {
              customerId: string;
              returnUrl: string;
            }) => Promise<{ billingUrl?: string | null } | undefined>;
          }
        | undefined;
    }>;
    readBillingRuntimeSettingsCached: () => Promise<BillingRuntimeSettings>;
    readPaymentRuntimeBindings: () => Promise<PaymentRuntimeBindings>;
    updateSubscriptionBySubscriptionNo: (
      subscriptionNo: string,
      updates: {
        billingUrl: string;
      }
    ) => Promise<unknown>;
  }
) {
  const subscription = await deps.findSubscriptionBySubscriptionNo(
    input.subscriptionNo
  );
  if (!subscription) {
    return { status: 'not_found' } as const;
  }
  if (subscription.userId !== input.actorUserId) {
    return { status: 'forbidden' } as const;
  }
  if (!subscription.paymentProvider || !subscription.paymentUserId) {
    return { status: 'missing_customer' } as const;
  }

  const [settings, bindings] = await Promise.all([
    deps.readBillingRuntimeSettingsCached(),
    deps.readPaymentRuntimeBindings(),
  ]);
  const paymentService = await deps.getPaymentService({
    settings,
    bindings,
  });
  const paymentProvider = paymentService.getProvider(
    subscription.paymentProvider
  );
  if (!paymentProvider?.getPaymentBilling) {
    throw new ServiceUnavailableError('payment provider not found');
  }

  const billing = await paymentProvider.getPaymentBilling({
    customerId: subscription.paymentUserId,
    returnUrl: input.returnUrl,
  });
  if (!billing?.billingUrl) {
    return { status: 'missing_billing_url' } as const;
  }

  await deps.updateSubscriptionBySubscriptionNo(subscription.subscriptionNo, {
    billingUrl: billing.billingUrl,
  });

  return {
    status: 'ok',
    billingUrl: billing.billingUrl,
  } as const;
}

export async function cancelSubscriptionUseCase(
  input: {
    subscriptionNo: string;
    actorUserId: string;
  },
  deps: {
    findSubscriptionBySubscriptionNo: (subscriptionNo: string) => Promise<
      | {
          subscriptionNo: string;
          userId: string;
          subscriptionId?: string | null;
          paymentProvider?: string | null;
          status?: string | null;
        }
      | undefined
    >;
    getPaymentService: (input: {
      settings: BillingRuntimeSettings;
      bindings: PaymentRuntimeBindings;
    }) => Promise<{
      getProvider: (provider: string) =>
        | {
            cancelSubscription?: (input: {
              subscriptionId: string;
            }) => Promise<unknown>;
          }
        | undefined;
    }>;
    readBillingRuntimeSettingsCached: () => Promise<BillingRuntimeSettings>;
    readPaymentRuntimeBindings: () => Promise<PaymentRuntimeBindings>;
    updateSubscriptionBySubscriptionNo: (
      subscriptionNo: string,
      updates: {
        status: string;
      }
    ) => Promise<unknown>;
  }
) {
  const subscription = await deps.findSubscriptionBySubscriptionNo(
    input.subscriptionNo
  );
  if (!subscription || !subscription.subscriptionId) {
    return { status: 'not_found' } as const;
  }
  if (subscription.userId !== input.actorUserId) {
    return { status: 'forbidden' } as const;
  }
  if (!isCancelableSubscriptionStatus(subscription.status)) {
    return { status: 'invalid_status' } as const;
  }
  if (!subscription.paymentProvider) {
    return { status: 'missing_provider' } as const;
  }

  const [settings, bindings] = await Promise.all([
    deps.readBillingRuntimeSettingsCached(),
    deps.readPaymentRuntimeBindings(),
  ]);
  const paymentService = await deps.getPaymentService({
    settings,
    bindings,
  });
  const paymentProvider = paymentService.getProvider(
    subscription.paymentProvider
  );
  if (!paymentProvider?.cancelSubscription) {
    throw new ServiceUnavailableError('payment provider not found');
  }

  const result = await paymentProvider.cancelSubscription({
    subscriptionId: subscription.subscriptionId,
  });
  if (!result) {
    return { status: 'cancel_failed' } as const;
  }

  await deps.updateSubscriptionBySubscriptionNo(subscription.subscriptionNo, {
    status: 'canceled',
  });

  return { status: 'ok' } as const;
}

export async function retrieveMemberInvoiceUrl(input: {
  orderNo: string;
  actorUserId: string;
}) {
  const [
    { getPaymentService },
    { findOrderByOrderNo, updateOrderByOrderNo },
    { readBillingRuntimeSettingsCached },
  ] = await Promise.all([
    import('@/infra/adapters/payment/service'),
    import('@/domains/billing/infra/order'),
    import('@/domains/settings/application/settings-runtime.query'),
  ]);
  const { getPaymentRuntimeBindings } =
    await import('@/infra/adapters/payment/runtime-bindings');

  return retrieveInvoiceUseCase(input, {
    findOrderByOrderNo,
    getPaymentService,
    readBillingRuntimeSettingsCached,
    readPaymentRuntimeBindings: async () => getPaymentRuntimeBindings(),
    updateOrderByOrderNo,
  });
}

export async function retrieveMemberBillingPortalUrl(input: {
  subscriptionNo: string;
  actorUserId: string;
  returnUrl: string;
}) {
  const [
    { getPaymentService },
    { findSubscriptionBySubscriptionNo, updateSubscriptionBySubscriptionNo },
    { readBillingRuntimeSettingsCached },
  ] = await Promise.all([
    import('@/infra/adapters/payment/service'),
    import('@/domains/billing/infra/subscription'),
    import('@/domains/settings/application/settings-runtime.query'),
  ]);
  const { getPaymentRuntimeBindings } =
    await import('@/infra/adapters/payment/runtime-bindings');

  return retrieveBillingPortalUseCase(input, {
    findSubscriptionBySubscriptionNo,
    getPaymentService,
    readBillingRuntimeSettingsCached,
    readPaymentRuntimeBindings: async () => getPaymentRuntimeBindings(),
    updateSubscriptionBySubscriptionNo,
  });
}

export async function cancelMemberSubscription(input: {
  subscriptionNo: string;
  actorUserId: string;
}) {
  const [
    { getPaymentService },
    { findSubscriptionBySubscriptionNo, updateSubscriptionBySubscriptionNo },
    { readBillingRuntimeSettingsCached },
  ] = await Promise.all([
    import('@/infra/adapters/payment/service'),
    import('@/domains/billing/infra/subscription'),
    import('@/domains/settings/application/settings-runtime.query'),
  ]);
  const { getPaymentRuntimeBindings } =
    await import('@/infra/adapters/payment/runtime-bindings');

  const result = await cancelSubscriptionUseCase(input, {
    findSubscriptionBySubscriptionNo,
    getPaymentService,
    readBillingRuntimeSettingsCached,
    readPaymentRuntimeBindings: async () => getPaymentRuntimeBindings(),
    updateSubscriptionBySubscriptionNo,
  });

  if (result.status !== 'ok') {
    return result;
  }

  return {
    status: 'ok',
    nextStatus: 'canceled',
  } as const;
}

export async function readCancelableSubscriptionPageUseCase(
  input: {
    subscriptionNo: string;
    actorUserId: string;
  },
  deps: {
    findSubscriptionBySubscriptionNo: (
      subscriptionNo: string
    ) => Promise<MemberSubscriptionRow | undefined>;
    getPaymentService: (input: {
      settings: BillingRuntimeSettings;
      bindings: PaymentRuntimeBindings;
    }) => Promise<{
      getProvider: (provider: string) =>
        | {
            cancelSubscription?: (input: {
              subscriptionId: string;
            }) => Promise<unknown>;
          }
        | undefined;
    }>;
    readBillingRuntimeSettingsCached: () => Promise<BillingRuntimeSettings>;
    readPaymentRuntimeBindings: () => Promise<PaymentRuntimeBindings>;
  }
): Promise<
  | { status: 'ok'; subscription: MemberSubscriptionRow }
  | {
      status:
        | 'not_found'
        | 'forbidden'
        | 'missing_subscription_target'
        | 'provider_not_found';
    }
> {
  const subscription = await deps.findSubscriptionBySubscriptionNo(
    input.subscriptionNo
  );
  if (!subscription) {
    return { status: 'not_found' };
  }
  if (subscription.userId !== input.actorUserId) {
    return { status: 'forbidden' };
  }
  if (!subscription.paymentProvider || !subscription.subscriptionId) {
    return { status: 'missing_subscription_target' };
  }

  const paymentProvider = await resolveCancelableSubscriptionProvider(
    subscription.paymentProvider,
    deps
  );
  if (!paymentProvider?.cancelSubscription) {
    return { status: 'provider_not_found' };
  }

  return { status: 'ok', subscription };
}

async function resolveCancelableSubscriptionProvider(
  providerName: string,
  deps: Pick<
    Parameters<typeof readCancelableSubscriptionPageUseCase>[1],
    | 'getPaymentService'
    | 'readBillingRuntimeSettingsCached'
    | 'readPaymentRuntimeBindings'
  >
) {
  try {
    const [settings, bindings] = await Promise.all([
      deps.readBillingRuntimeSettingsCached(),
      deps.readPaymentRuntimeBindings(),
    ]);
    const paymentService = await deps.getPaymentService({
      settings,
      bindings,
    });
    return paymentService.getProvider(providerName);
  } catch {
    return undefined;
  }
}

export async function readMemberCancelableSubscription(input: {
  subscriptionNo: string;
  actorUserId: string;
}): Promise<
  | { status: 'ok'; subscription: MemberSubscriptionRow }
  | {
      status:
        | 'not_found'
        | 'forbidden'
        | 'missing_subscription_target'
        | 'provider_not_found';
    }
> {
  const [
    { getPaymentService },
    { findSubscriptionBySubscriptionNo },
    { readBillingRuntimeSettingsCached },
  ] = await Promise.all([
    import('@/infra/adapters/payment/service'),
    import('@/domains/billing/infra/subscription'),
    import('@/domains/settings/application/settings-runtime.query'),
  ]);
  const { getPaymentRuntimeBindings } =
    await import('@/infra/adapters/payment/runtime-bindings');

  return readCancelableSubscriptionPageUseCase(input, {
    findSubscriptionBySubscriptionNo,
    getPaymentService,
    readBillingRuntimeSettingsCached,
    readPaymentRuntimeBindings: async () => getPaymentRuntimeBindings(),
  });
}
