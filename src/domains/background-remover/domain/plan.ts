import type {
  BackgroundRemoverActor,
  BackgroundRemoverPlanLimits,
} from './types';

function numberEntitlement(
  entitlements: Record<string, string | number | boolean> | undefined,
  key: string,
  fallback: number
): number {
  const value = entitlements?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function resolveBackgroundRemoverPlanLimits(
  actor: BackgroundRemoverActor
): BackgroundRemoverPlanLimits {
  const entitlements =
    actor.productAccess?.entitlements ??
    (actor.kind === 'user' ? actor.entitlements : undefined);

  if (actor.kind === 'anonymous') {
    return {
      productId: 'guest',
      processingLimit: numberEntitlement(
        entitlements,
        'guest_daily_removals',
        2
      ),
      processingWindow: 'day',
      maxUploadMb: numberEntitlement(entitlements, 'max_upload_mb', 10),
      retentionDays: 1,
    };
  }

  const productId = actor.productAccess?.productId ?? actor.productId ?? 'free';
  const isPaid = productId !== 'free';
  const usesMonthlyWindow =
    isPaid || typeof entitlements?.monthly_removals === 'number';

  return {
    productId,
    processingLimit: usesMonthlyWindow
      ? numberEntitlement(entitlements, 'monthly_removals', 5)
      : numberEntitlement(entitlements, 'daily_removals', 5),
    processingWindow: usesMonthlyWindow ? 'month' : 'day',
    maxUploadMb: numberEntitlement(entitlements, 'max_upload_mb', 10),
    retentionDays: numberEntitlement(entitlements, 'retention_days', 7),
  };
}

export function addBackgroundRemoverRetentionDays(
  now: Date,
  retentionDays: number
): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + Math.max(1, retentionDays));
  return expiresAt;
}
