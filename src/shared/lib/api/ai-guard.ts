import 'server-only';

import { isAiEnabledCached } from '@/shared/lib/ai-enabled.server';

import { NotFoundError } from './errors';

export async function requireAiEnabled(): Promise<void> {
  if (await isAiEnabledCached()) {
    return;
  }

  // Intentionally return 404 to avoid disclosing feature availability.
  throw new NotFoundError('not found');
}
