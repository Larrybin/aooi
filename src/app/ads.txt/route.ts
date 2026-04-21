import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { readRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import {
  getAdsTxtBody,
  resolveAdsRuntime,
} from '@/infra/adapters/ads/runtime';

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
