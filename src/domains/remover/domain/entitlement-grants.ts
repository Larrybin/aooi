import type { RemoverActor } from './types';

export function formatRemoverEntitlementGrantIdsJson(
  actor: RemoverActor
): string | undefined {
  if (actor.kind !== 'user' || !actor.entitlementGrantIds?.length) {
    return;
  }

  return JSON.stringify(actor.entitlementGrantIds);
}
