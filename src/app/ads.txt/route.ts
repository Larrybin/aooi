import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { getAllConfigs } from '@/shared/models/config';
import {
  getAdsTxtBody,
  resolveAdsRuntime,
} from '@/shared/services/ads-runtime';

import { buildAdsTxtResponse } from './response';

export async function GET(req: Request) {
  const { log } = getRequestLogger(req);
  try {
    const configs = await getAllConfigs();
    const runtime = resolveAdsRuntime(configs);
    return buildAdsTxtResponse(getAdsTxtBody(runtime));
  } catch (error) {
    log.error('ads.txt: get configs failed', { error });
    return buildAdsTxtResponse('');
  }
}
