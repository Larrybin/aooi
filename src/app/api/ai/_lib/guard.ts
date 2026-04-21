import 'server-only';

import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';

import { NotFoundError } from '@/shared/lib/api/errors';

export async function requireAiEnabled(): Promise<void> {
  if (isAiEnabled(await getPublicConfigsCached())) {
    return;
  }

  // Intentionally return 404 to avoid disclosing feature availability.
  throw new NotFoundError('not found');
}
