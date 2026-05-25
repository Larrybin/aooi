import 'server-only';

import { cookies } from 'next/headers';
import type { BackgroundRemoverActor } from '@/domains/background-remover/domain/types';
import { getCurrentSubscription } from '@/domains/billing/infra/subscription';
import { resolveAppEnvironment } from '@/domains/entitlements/domain/types';
import { listActiveEntitlementGrantsForScope } from '@/domains/entitlements/infra/grant';
import { resolveProductAccess } from '@/domains/product-entitlements/application/resolve-product-access';
import {
  resolveAnonymousSessionForRequest,
  writeAnonymousSessionCookie,
} from '@/domains/remover/application/actor-session';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import {
  getRuntimeEnvString,
  isRuntimeEnvEnabled,
} from '@/infra/runtime/env.server';
import { site, sitePricing } from '@/site';

import { assertCsrf } from '@/shared/lib/api/csrf.server';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';

function getAnonymousSessionSecret(): string {
  return (
    getRuntimeEnvString('BETTER_AUTH_SECRET')?.trim() ||
    getRuntimeEnvString('AUTH_SECRET')?.trim() ||
    ''
  );
}

function resolveEntitlementEnvironment() {
  return resolveAppEnvironment({
    configured: getRuntimeEnvString('APP_ENVIRONMENT'),
    nodeEnv: getRuntimeEnvString('NODE_ENV'),
  });
}

export async function resolveBackgroundRemoverActor(
  req: Request
): Promise<BackgroundRemoverActor> {
  assertCsrf(req);

  const secret = getAnonymousSessionSecret();
  if (!secret) {
    throw new ServiceUnavailableError(
      'anonymous background remover session secret is not configured'
    );
  }

  const [user, anonymousSession] = await Promise.all([
    getSignedInUserIdentity(),
    resolveAnonymousSessionForRequest(req, { secret }),
  ]);
  if (anonymousSession.shouldSetCookie) {
    const cookieStore = await cookies();
    writeAnonymousSessionCookie({
      cookieStore,
      req,
      session: anonymousSession,
    });
  }

  if (!user) {
    const actor = {
      kind: 'anonymous',
      anonymousSessionId: anonymousSession.anonymousSessionId,
    } satisfies BackgroundRemoverActor;
    const productAccess = await resolveProductAccess({
      actor,
      siteKey: site.key,
      productKey: site.key,
      productId: 'free',
      environment: resolveEntitlementEnvironment(),
      pricing: sitePricing?.pricing,
    });

    return {
      ...actor,
      productAccess,
    };
  }

  const actor = {
    kind: 'user',
    userId: user.id,
    anonymousSessionId: anonymousSession.anonymousSessionId,
  } satisfies BackgroundRemoverActor;
  const productAccess = await resolveProductAccess({
    actor,
    siteKey: site.key,
    productKey: site.key,
    productId: 'free',
    environment: resolveEntitlementEnvironment(),
    pricing: sitePricing?.pricing,
    internalEntitlementGrantsEnabled: isRuntimeEnvEnabled(
      'INTERNAL_ENTITLEMENT_GRANTS_ENABLED'
    ),
    deps: {
      getSubscriptionProductId: async (userId) =>
        (await getCurrentSubscription(userId))?.productId,
      listGrants: listActiveEntitlementGrantsForScope,
    },
  });

  return {
    ...actor,
    productId: productAccess.productId,
    entitlements: productAccess.entitlements,
    entitlementGrantIds: productAccess.entitlementGrantIds,
    productAccess,
  };
}
