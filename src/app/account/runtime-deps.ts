import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import {
  type AccountAdminUserRecord,
  ACCOUNT_APIKEY_STATUS,
  ACCOUNT_CREDIT_STATUS,
  type AccountApikeyRecord,
  type AccountApikeyStatus,
  type AccountCreditRecord,
  type AccountCreditStatus,
  type AccountCreditTransactionType,
} from '@/domains/account/application/use-cases';
import { getNonceStr, getUuid } from '@/shared/lib/hash';
import {
  ApikeyStatus,
  createApikey,
  findApikeyById,
  getApikeys,
  getApikeysCount,
  updateApikey,
} from '@/domains/account/infra/apikey';
import {
  CreditStatus,
  CreditTransactionType,
  getCredits,
  getCreditsCount,
  getRemainingCredits,
  getRemainingCreditsSummary,
} from '@/domains/account/infra/credit';
import { getCurrentSubscription } from '@/domains/billing/infra/subscription';
import {
  findUserById,
  getUsers,
  getUsersCount,
  updateUser,
} from '@/domains/account/infra/user';

function toCreditStatus(status: AccountCreditStatus): CreditStatus {
  switch (status) {
    case ACCOUNT_CREDIT_STATUS.ACTIVE:
      return CreditStatus.ACTIVE;
    case ACCOUNT_CREDIT_STATUS.EXPIRED:
      return CreditStatus.EXPIRED;
    case ACCOUNT_CREDIT_STATUS.DELETED:
      return CreditStatus.DELETED;
  }
}

function toCreditTransactionType(
  transactionType?: AccountCreditTransactionType
): CreditTransactionType | undefined {
  if (!transactionType) {
    return undefined;
  }

  switch (transactionType) {
    case 'grant':
      return CreditTransactionType.GRANT;
    case 'consume':
      return CreditTransactionType.CONSUME;
  }
}

function toApikeyStatus(status: AccountApikeyStatus): ApikeyStatus {
  switch (status) {
    case ACCOUNT_APIKEY_STATUS.ACTIVE:
      return ApikeyStatus.ACTIVE;
    case ACCOUNT_APIKEY_STATUS.DELETED:
      return ApikeyStatus.DELETED;
  }
}

function mapApikeyRecord(record: Awaited<ReturnType<typeof findApikeyById>>): AccountApikeyRecord | undefined {
  if (!record) {
    return undefined;
  }

  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    key: record.key,
    status: record.status,
    deletedAt: record.deletedAt,
    createdAt: record.createdAt,
  };
}

function mapCreditRecord(record: Awaited<ReturnType<typeof getCredits>>[number]): AccountCreditRecord {
  return {
    id: record.id,
    userId: record.userId,
    transactionNo: record.transactionNo,
    description: record.description,
    transactionType: record.transactionType,
    transactionScene: record.transactionScene,
    credits: record.credits,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

function mapAdminUserRecord(
  record: Awaited<ReturnType<typeof getUsers>>[number]
): AccountAdminUserRecord {
  return {
    id: record.id,
    name: record.name,
    image: record.image,
    email: record.email,
    emailVerified: record.emailVerified,
    createdAt: record.createdAt,
  };
}

function mapUserRecord(
  record: Awaited<ReturnType<typeof findUserById>>
): AccountAdminUserRecord | undefined {
  if (!record) {
    return undefined;
  }

  return {
    id: record.id,
    name: record.name,
    image: record.image,
    email: record.email,
    emailVerified: record.emailVerified,
    createdAt: record.createdAt,
  };
}

export const accountRuntimeDeps = {
  hasPermission: accessControlRuntimeDeps.checkUserPermission,
  getRemainingCreditsSummary,
  getRemainingCredits,
  getCredits: async ({
    userId,
    status,
    transactionType,
    page,
    limit,
  }: {
    userId: string;
    status: AccountCreditStatus;
    transactionType?: AccountCreditTransactionType;
    page: number;
    limit: number;
  }) =>
    (
      await getCredits({
        userId,
        status: toCreditStatus(status),
        transactionType: toCreditTransactionType(transactionType),
        page,
        limit,
      })
    ).map(mapCreditRecord),
  getCreditsCount: ({
    userId,
    status,
    transactionType,
  }: {
    userId: string;
    status: AccountCreditStatus;
    transactionType?: AccountCreditTransactionType;
  }) =>
    getCreditsCount({
      userId,
      status: toCreditStatus(status),
      transactionType: toCreditTransactionType(transactionType),
    }),
  getUsers: async ({
    email,
    page,
    limit,
  }: {
    email?: string;
    page: number;
    limit: number;
  }) => (await getUsers({ email, page, limit })).map(mapAdminUserRecord),
  getUsersCount: ({ email }: { email?: string }) => getUsersCount({ email }),
  findUserById: async (userId: string) => mapUserRecord(await findUserById(userId)),
  getCurrentSubscription,
  updateUser,
  getApikeys: async ({
    userId,
    status,
    page,
    limit,
  }: {
    userId: string;
    status: AccountApikeyStatus;
    page: number;
    limit: number;
  }) =>
    (
      await getApikeys({
        userId,
        status: toApikeyStatus(status),
        page,
        limit,
      })
    ).map((record) => mapApikeyRecord(record) as AccountApikeyRecord),
  getApikeysCount: ({
    userId,
    status,
  }: {
    userId: string;
    status: AccountApikeyStatus;
  }) =>
    getApikeysCount({
      userId,
      status: toApikeyStatus(status),
    }),
  findApikeyById: async (id: string) => mapApikeyRecord(await findApikeyById(id)),
  createApikey: async (record: {
    id: string;
    userId: string;
    title: string;
    key: string;
    status: AccountApikeyStatus;
  }) =>
    (await createApikey({
      ...record,
      status: toApikeyStatus(record.status),
    })) as AccountApikeyRecord,
  updateApikey: async (
    id: string,
    update: {
      title?: string;
      status?: AccountApikeyStatus;
      deletedAt?: Date;
    }
  ) =>
    (await updateApikey(id, {
      ...update,
      status: update.status ? toApikeyStatus(update.status) : undefined,
    })) as AccountApikeyRecord,
  createId: getUuid,
  createSecretKey: () => `sk-${getNonceStr(32)}`,
};
