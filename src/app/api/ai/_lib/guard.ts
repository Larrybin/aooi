import 'server-only';

import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';

import { NotFoundError } from '@/shared/lib/api/errors';

export async function requireAiEnabled(): Promise<void> {
  if (isAiEnabled(await readPublicUiConfigCached())) {
    return;
  }

  // Intentionally return 404 to avoid disclosing feature availability.
  throw new NotFoundError('not found');
}
