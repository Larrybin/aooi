import {
  PaymentEventType,
  PaymentStatus,
  SubscriptionCycleType,
  SubscriptionStatus,
  type PaymentSession,
  type SubscriptionInfo,
} from '@/domains/billing/domain/payment';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

// PayPal reports money as major-unit decimal strings ("99.00"), while orders and the
// rest of the billing domain keep minor units (9900). Every amount read back from
// PayPal therefore has to be scaled by 100, and the scaling is done on the digits
// rather than `value * 100` so that values such as 19.99 stay exact.
function readMinorUnits(value: unknown): number | undefined {
  const raw =
    typeof value === 'number' && Number.isFinite(value)
      ? value.toString()
      : readString(value);
  if (!raw) return undefined;

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match) return undefined;

  const [, sign, whole = '', fraction = ''] = match;
  if (!whole && !fraction) return undefined;

  // Currencies with more precision than the stored minor unit round half up.
  const padded = `${fraction}000`;
  const minor =
    Number(`${whole || '0'}${padded.slice(0, 2)}`) +
    (Number(padded[2]) >= 5 ? 1 : 0);
  return sign === '-' ? -minor : minor;
}

function readPath(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }

    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function readStringPath(
  root: unknown,
  path: string[]
): string | undefined {
  return readString(readPath(root, path));
}

function readMinorUnitsPath(root: unknown, path: string[]): number | undefined {
  return readMinorUnits(readPath(root, path));
}

function readDateTime(value: unknown): Date | undefined {
  const stringValue = readString(value);
  if (!stringValue) return undefined;

  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function readDateTimePath(root: unknown, path: string[]): Date | undefined {
  return readDateTime(readPath(root, path));
}

export function extractApprovalUrl(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const links = payload.links;
  if (!Array.isArray(links)) return undefined;

  for (const link of links) {
    if (!isRecord(link)) continue;
    if (readString(link.rel) === 'approve') {
      return readString(link.href);
    }
  }

  return undefined;
}

function extractPayPalStatus(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  return readString(payload.status);
}

function extractPayPalAmount(payload: unknown): number | undefined {
  return (
    readMinorUnitsPath(payload, ['amount']) ??
    readMinorUnitsPath(payload, ['amount', 'value']) ??
    readMinorUnitsPath(payload, ['purchase_units', '0', 'amount', 'value']) ??
    readMinorUnitsPath(payload, [
      'billing_info',
      'last_payment',
      'amount',
      'value',
    ])
  );
}

function extractPayPalCurrency(payload: unknown): string | undefined {
  return (
    readStringPath(payload, ['currency']) ??
    readStringPath(payload, ['amount', 'currency_code']) ??
    readStringPath(payload, [
      'purchase_units',
      '0',
      'amount',
      'currency_code',
    ]) ??
    readStringPath(payload, [
      'billing_info',
      'last_payment',
      'amount',
      'currency_code',
    ])
  );
}

function extractPayPalCustomerEmail(payload: unknown): string | undefined {
  return (
    readStringPath(payload, ['customer_email']) ??
    readStringPath(payload, ['payer', 'email_address']) ??
    readStringPath(payload, ['subscriber', 'email_address'])
  );
}

function extractPayPalOrderNo(payload: unknown): string | undefined {
  return (
    readStringPath(payload, ['custom_id']) ??
    readStringPath(payload, ['purchase_units', '0', 'custom_id']) ??
    readStringPath(payload, ['purchase_units', '0', 'invoice_id'])
  );
}

function extractPayPalMetadata(
  payload: unknown
): Record<string, unknown> | undefined {
  const value = readPath(payload, ['metadata']);
  const metadata = isRecord(value) ? value : undefined;

  const orderNo = extractPayPalOrderNo(payload);
  if (!metadata && !orderNo) return undefined;

  return {
    ...(metadata || {}),
    ...(orderNo ? { order_no: orderNo } : {}),
  };
}

function extractPayPalTransactionId(result: unknown): string | undefined {
  const fromLastPayment = readStringPath(result, [
    'billing_info',
    'last_payment',
    'transaction_id',
  ]);
  if (fromLastPayment) return fromLastPayment;

  const fromCapture = readStringPath(result, [
    'purchase_units',
    '0',
    'payments',
    'captures',
    '0',
    'id',
  ]);
  if (fromCapture) return fromCapture;

  const fromSale = readStringPath(result, [
    'purchase_units',
    '0',
    'payments',
    'sales',
    '0',
    'id',
  ]);
  if (fromSale) return fromSale;

  return readStringPath(result, ['id']);
}

function extractPayPalInvoiceId(result: unknown): string | undefined {
  return (
    readStringPath(result, ['invoice_id']) ||
    readStringPath(result, ['purchase_units', '0', 'invoice_id'])
  );
}

export function mapPayPalStatus(status: string): PaymentStatus {
  switch (status) {
    case 'CREATED':
    case 'SAVED':
    case 'APPROVED':
      return PaymentStatus.PROCESSING;
    case 'COMPLETED':
    case 'ACTIVE':
      return PaymentStatus.SUCCESS;
    case 'CANCELED':
    case 'CANCELLED':
    case 'EXPIRED':
      return PaymentStatus.CANCELED;
    case 'SUSPENDED':
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.PROCESSING;
  }
}

function mapPayPalSubscriptionStatus(
  status: string
): SubscriptionStatus | undefined {
  switch (status) {
    case 'ACTIVE':
      return SubscriptionStatus.ACTIVE;
    case 'SUSPENDED':
      return SubscriptionStatus.PAUSED;
    case 'CANCELLED':
      return SubscriptionStatus.CANCELED;
    case 'EXPIRED':
      return SubscriptionStatus.EXPIRED;
    case 'APPROVAL_PENDING':
    case 'APPROVED':
      return SubscriptionStatus.TRIALING;
    default:
      return undefined;
  }
}

export function buildPayPalPaymentSession({
  provider,
  result,
}: {
  provider: string;
  result: unknown;
}): PaymentSession {
  return {
    provider,
    paymentStatus: mapPayPalStatus(extractPayPalStatus(result) || 'CREATED'),
    paymentInfo: {
      discountCode: '',
      discountAmount: undefined,
      discountCurrency: undefined,
      transactionId: extractPayPalTransactionId(result),
      paymentAmount: extractPayPalAmount(result) || 0,
      paymentCurrency: extractPayPalCurrency(result) || '',
      paymentEmail: extractPayPalCustomerEmail(result),
      invoiceId: extractPayPalInvoiceId(result),
      paidAt: new Date(),
    },
    paymentResult: result,
    metadata: extractPayPalMetadata(result),
  };
}

export function extractPayPalWebhookSubscriptionId(
  payload: unknown
): string | undefined {
  return (
    readStringPath(payload, ['billing_agreement_id']) ??
    readStringPath(payload, ['subscription_id']) ??
    readStringPath(payload, [
      'supplementary_data',
      'related_ids',
      'subscription_id',
    ])
  );
}

export function buildPayPalWebhookPaymentSession({
  provider,
  resource,
}: {
  provider: string;
  resource: unknown;
}): PaymentSession {
  return {
    provider,
    paymentStatus: PaymentStatus.SUCCESS,
    paymentInfo: {
      discountCode: '',
      discountAmount: undefined,
      discountCurrency: undefined,
      transactionId: extractPayPalTransactionId(resource),
      paymentAmount: extractPayPalAmount(resource) || 0,
      paymentCurrency: extractPayPalCurrency(resource) || '',
      paymentEmail: extractPayPalCustomerEmail(resource),
      invoiceId: extractPayPalInvoiceId(resource),
      paidAt: new Date(),
    },
    paymentResult: resource,
    metadata: extractPayPalMetadata(resource),
  };
}

export function mergePayPalRenewalSubscription({
  session,
  subscription,
  subscriptionId,
}: {
  session: PaymentSession;
  subscription: unknown;
  subscriptionId: string;
}): PaymentSession {
  return {
    ...session,
    paymentInfo: session.paymentInfo
      ? {
          ...session.paymentInfo,
          subscriptionCycleType: SubscriptionCycleType.RENEWAL,
        }
      : undefined,
    subscriptionId,
    subscriptionInfo: buildPayPalSubscriptionInfo({
      subscription,
      subscriptionId,
      eventType: PaymentEventType.SUBSCRIBE_UPDATED,
    }),
    subscriptionResult: subscription,
  };
}

export function buildPayPalSubscriptionInfo({
  subscription,
  subscriptionId,
  eventType,
}: {
  subscription: unknown;
  subscriptionId: string;
  eventType:
    | PaymentEventType.SUBSCRIBE_UPDATED
    | PaymentEventType.SUBSCRIBE_CANCELED;
}): SubscriptionInfo {
  const statusValue = readStringPath(subscription, ['status']);
  const mappedStatus = statusValue
    ? mapPayPalSubscriptionStatus(statusValue)
    : undefined;

  const status =
    eventType === PaymentEventType.SUBSCRIBE_CANCELED
      ? SubscriptionStatus.CANCELED
      : (mappedStatus ?? SubscriptionStatus.ACTIVE);

  const currentPeriodStart =
    readDateTimePath(subscription, ['billing_info', 'last_payment', 'time']) ??
    readDateTimePath(subscription, ['start_time']) ??
    new Date();

  const currentPeriodEnd =
    readDateTimePath(subscription, ['billing_info', 'next_billing_time']) ??
    readDateTimePath(subscription, ['billing_info', 'final_payment_time']) ??
    currentPeriodStart;

  const subscriptionInfo: SubscriptionInfo = {
    subscriptionId,
    planId: readStringPath(subscription, ['plan_id']) ?? undefined,
    currentPeriodStart,
    currentPeriodEnd,
    status,
  };

  if (status === SubscriptionStatus.CANCELED) {
    const canceledAt =
      readDateTimePath(subscription, ['status_update_time']) ??
      readDateTimePath(subscription, ['update_time']) ??
      new Date();

    subscriptionInfo.canceledAt = canceledAt;

    const canceledEndAt =
      readDateTimePath(subscription, ['billing_info', 'final_payment_time']) ??
      readDateTimePath(subscription, ['billing_info', 'next_billing_time']);

    if (canceledEndAt) {
      subscriptionInfo.canceledEndAt = canceledEndAt;
    } else if (currentPeriodEnd.getTime() >= canceledAt.getTime()) {
      subscriptionInfo.canceledEndAt = currentPeriodEnd;
    }
  }

  return subscriptionInfo;
}

export function buildPayPalSubscriptionSession({
  provider,
  subscription,
  subscriptionId,
  eventType,
}: {
  provider: string;
  subscription: unknown;
  subscriptionId: string;
  eventType:
    | PaymentEventType.SUBSCRIBE_UPDATED
    | PaymentEventType.SUBSCRIBE_CANCELED;
}): PaymentSession {
  return {
    provider,
    paymentStatus: mapPayPalStatus(extractPayPalStatus(subscription) || ''),
    subscriptionId,
    subscriptionInfo: buildPayPalSubscriptionInfo({
      subscription,
      subscriptionId,
      eventType,
    }),
    subscriptionResult: subscription,
    metadata: extractPayPalMetadata(subscription),
  };
}
