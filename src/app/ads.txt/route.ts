import {
  getAdsRuntimeFresh,
  getAdsTxtBody,
} from '@/infra/adapters/ads/service';
import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';

import { buildAdsTxtResponse } from './response';

export async function GET(req: Request) {
  const { log } = getRequestLogger(req);
  try {
    const runtime = await getAdsRuntimeFresh();
    return buildAdsTxtResponse(getAdsTxtBody(runtime));
  } catch (error) {
    log.error('ads.txt: get configs failed', { error });
    return buildAdsTxtResponse('');
  }
}
