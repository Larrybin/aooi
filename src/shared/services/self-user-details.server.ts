import type {
  SelfUserDetails,
  UserCreditsSummary,
} from '@/shared/types/auth-session';

type ReadSelfUserDetailsDeps = {
  hasPermission: (userId: string, permission: string) => Promise<boolean>;
  getRemainingCreditsSummary: (userId: string) => Promise<{
    remainingCredits: number;
    expiresAt: string | null;
  } | null>;
  getCurrentSubscription: (userId: string) => Promise<{
    productId?: string | null;
  } | null>;
};

type CreditsSummaryInput = {
  remainingCredits: number;
  expiresAt: string | null;
} | null;

function toCreditsSummary(value: CreditsSummaryInput): UserCreditsSummary | null {
  if (!value) {
    return null;
  }

  return {
    remainingCredits: value.remainingCredits,
    expiresAt: value.expiresAt,
  };
}

export async function readSelfUserDetails(
  userId: string,
  deps?: ReadSelfUserDetailsDeps
): Promise<SelfUserDetails> {
  const resolvedDeps =
    deps ??
    (await (async (): Promise<ReadSelfUserDetailsDeps> => {
      const [{ checkUserPermission }, { getRemainingCreditsSummary }, { getCurrentSubscription }] =
        await Promise.all([
          import('@/core/rbac'),
          import('@/shared/models/credit'),
          import('@/shared/models/subscription'),
        ]);

      return {
        hasPermission: (targetUserId, permission) =>
          checkUserPermission(targetUserId, permission),
        getRemainingCreditsSummary: (targetUserId) =>
          getRemainingCreditsSummary(targetUserId),
        getCurrentSubscription: (targetUserId) =>
          getCurrentSubscription(targetUserId),
      };
    })());

  const { PERMISSIONS } = await import('@/shared/constants/rbac-permissions');
  const [isAdmin, credits, currentSubscription] = await Promise.all([
    resolvedDeps.hasPermission(userId, PERMISSIONS.ADMIN_ACCESS),
    resolvedDeps.getRemainingCreditsSummary(userId),
    resolvedDeps.getCurrentSubscription(userId),
  ]);

  return {
    isAdmin,
    credits: toCreditsSummary(credits),
    currentSubscriptionProductId: currentSubscription?.productId ?? null,
  };
}
