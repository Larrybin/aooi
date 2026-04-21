import 'server-only';

import { isAiEnabledCached } from '@/domains/ai/application/ai-enabled.query';

import { NotFoundError } from '@/shared/lib/api/errors';

export async function requireAiEnabled(): Promise<void> {
  if (await isAiEnabledCached()) {
    return;
  }

  // Intentionally return 404 to avoid disclosing feature availability.
  throw new NotFoundError('not found');
}
