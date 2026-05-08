type RefundConsumedCreditResult =
  | { refunded: true }
  | {
      refunded: false;
      reason:
        | 'not_found'
        | 'not_consume'
        | 'not_active'
        | 'invalid_consumed_detail';
    };

export type RefundConsumedCreditById = (
  creditId: string
) => Promise<RefundConsumedCreditResult>;

type AiTaskCreditRefundLog = {
  error: (message: string, meta?: unknown) => void;
};

export async function refundFailedAITaskCredit(
  input: {
    taskId: string;
    creditId?: string | null;
    log: AiTaskCreditRefundLog;
  },
  deps: {
    refundConsumedCreditById: RefundConsumedCreditById;
  }
) {
  const creditId = input.creditId?.trim();
  if (!creditId) return;

  const refund = await deps.refundConsumedCreditById(creditId);
  if (!refund.refunded && refund.reason === 'invalid_consumed_detail') {
    input.log.error('credit: invalid consumedDetail payload, skip refund', {
      operation: 'refund-failed-task-credit',
      aiTaskId: input.taskId,
      creditId,
    });
  }
}
