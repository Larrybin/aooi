import type { ProductActor } from '@/domains/product-access/domain/actor';
import type { ProductOwner } from '@/domains/product-access/domain/ownership';
import type { ProductAccessContext } from '@/domains/product-entitlements/domain/schema';

export type BackgroundRemoverActor =
  | (Extract<ProductActor, { kind: 'user' }> & {
      productId?: string | null;
      entitlements?: Record<string, string | number | boolean>;
      entitlementGrantIds?: string[];
      productAccess?: ProductAccessContext;
    })
  | (Extract<ProductActor, { kind: 'anonymous' }> & {
      productId?: null;
      productAccess?: ProductAccessContext;
    });

export type BackgroundRemoverOwner = ProductOwner;

export type BackgroundRemoverPlanLimits = {
  productId: string;
  processingLimit: number;
  processingWindow: 'day' | 'month';
  maxUploadMb: number;
  retentionDays: number;
};

export type BackgroundRemoverQuotaOperationKey = 'background_remover.remove';

export const BACKGROUND_REMOVER_QUOTA_OPERATION_KEYS = {
  remove: 'background_remover.remove',
} as const satisfies Record<string, BackgroundRemoverQuotaOperationKey>;

export type BackgroundRemoverImageStatus = 'active' | 'deleted';
