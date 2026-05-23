import 'server-only';

import { cookies } from 'next/headers';
import { resolvePricingEntitlements } from '@/domains/billing/domain/pricing';
import { getCurrentSubscription } from '@/domains/billing/infra/subscription';
import { resolveEffectiveEntitlements } from '@/domains/entitlements/application/resolve';
import { resolveAppEnvironment } from '@/domains/entitlements/domain/types';
import { listActiveEntitlementGrantsForScope } from '@/domains/entitlements/infra/grant';
import {
  resolveAnonymousSessionForRequest,
  writeAnonymousSessionCookie,
} from '@/domains/remover/application/actor-session';
import type { RemoverActor } from '@/domains/remover/domain/types';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import {
  getRuntimeEnvString,
  isRuntimeEnvEnabled,
} from '@/infra/runtime/env.server';
import { site } from '@/site';

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

export async function resolveRemoverActorFromRequest(
  req: Request
): Promise<RemoverActor> {
  assertCsrf(req);

  const secret = getAnonymousSessionSecret();
  if (!secret) {
    throw new ServiceUnavailableError(
      'anonymous remover session secret is not configured'
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
    return {
      kind: 'anonymous',
      anonymousSessionId: anonymousSession.anonymousSessionId,
    };
  }

  const subscription = await getCurrentSubscription(user.id);
  const productId = subscription?.productId || 'free';
  const effectiveEntitlements = await resolveEffectiveEntitlements({
    userId: user.id,
    siteKey: site.key,
    productKey: site.key,
    baseEntitlements: resolvePricingEntitlements(productId),
    environment: resolveEntitlementEnvironment(),
    internalEntitlementGrantsEnabled: isRuntimeEnvEnabled(
      'INTERNAL_ENTITLEMENT_GRANTS_ENABLED'
    ),
    deps: {
      listGrants: listActiveEntitlementGrantsForScope,
    },
  });

  return {
    kind: 'user',
    userId: user.id,
    anonymousSessionId: anonymousSession.anonymousSessionId,
    productId,
    entitlements: effectiveEntitlements.entitlements,
    entitlementGrantIds: effectiveEntitlements.grantIds,
  };
}

export async function resolveRemoverActor(req: Request): Promise<RemoverActor> {
  return resolveRemoverActorFromRequest(req);
}
