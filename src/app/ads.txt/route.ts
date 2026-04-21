import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { readRuntimeSettingsCached } from '@/domains/settings/application/settings-store';
import {
  getAdsTxtBody,
  resolveAdsRuntime,
} from '@/shared/services/ads-runtime';

import { buildAdsTxtResponse } from './response';

export async function GET(req: Request) {
  const { log } = getRequestLogger(req);
  try {
    const configs = await readRuntimeSettingsCached();
    const runtime = resolveAdsRuntime(configs);
    return buildAdsTxtResponse(getAdsTxtBody(runtime));
  } catch (error) {
    log.error('ads.txt: get configs failed', { error });
    return buildAdsTxtResponse('');
  }
}
