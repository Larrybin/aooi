export const PAYMENT_WEBHOOK_INBOX_STATUS = {
  RECEIVED: 'received',
  PROCESSED: 'processed',
  IGNORED_UNKNOWN: 'ignored_unknown',
  PARSE_FAILED: 'parse_failed',
  PROCESS_FAILED: 'process_failed',
} as const;

export type PaymentWebhookInboxStatus =
  (typeof PAYMENT_WEBHOOK_INBOX_STATUS)[keyof typeof PAYMENT_WEBHOOK_INBOX_STATUS];

export const PAYMENT_WEBHOOK_OPERATION_KIND = {
  REPLAY: 'replay',
  COMPENSATION: 'compensation',
} as const;

export type PaymentWebhookOperationKind =
  (typeof PAYMENT_WEBHOOK_OPERATION_KIND)[keyof typeof PAYMENT_WEBHOOK_OPERATION_KIND];
