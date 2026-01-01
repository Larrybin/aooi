import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

async function getConfigsResponse() {
  const configs = await getPublicConfigsCached();
  return jsonOk(configs);
}

export const GET = withApi(async (_req: Request) => getConfigsResponse());
export const POST = withApi(async (_req: Request) => getConfigsResponse());
