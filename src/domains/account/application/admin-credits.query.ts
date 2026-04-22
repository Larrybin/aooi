import type {
  AccountCreditTransactionType,
} from './use-cases';
import {
  CreditStatus,
  CreditTransactionType,
  getCredits,
  getCreditsCount,
  type Credit,
} from '@/domains/account/infra/credit';

export type AdminCreditRow = Credit;

function toCreditTransactionType(
  value?: AccountCreditTransactionType
): CreditTransactionType | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'grant') {
    return CreditTransactionType.GRANT;
  }

  if (value === 'consume') {
    return CreditTransactionType.CONSUME;
  }

  return undefined;
}

export async function listAdminCreditsQuery(
  input: {
    page: number;
    limit: number;
    transactionType?: AccountCreditTransactionType;
  }
) {
  const [rows, total] = await Promise.all([
    getCredits({
      status: CreditStatus.ACTIVE,
      transactionType: toCreditTransactionType(input.transactionType),
      getUser: true,
      page: input.page,
      limit: input.limit,
    }),
    getCreditsCount({
      status: CreditStatus.ACTIVE,
      transactionType: toCreditTransactionType(input.transactionType),
    }),
  ]);

  return { rows, total };
}
