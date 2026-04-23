import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import { readSettingsCached } from '@/domains/settings/application/settings-store';
import {
  getAdsTxtBody,
  resolveAdsRuntime,
} from '@/infra/adapters/ads/runtime';

import { buildAdsTxtResponse } from './response';

export async function GET(req: Request) {
  const { log } = getRequestLogger(req);
  try {
    const configs = await readSettingsCached();
    const runtime = resolveAdsRuntime(configs);
    return buildAdsTxtResponse(getAdsTxtBody(runtime));
  } catch (error) {
    log.error('ads.txt: get configs failed', { error });
    return buildAdsTxtResponse('');
  }
}
