import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

export const POST = withApi(async () => {
  const configs = await getPublicConfigsCached();
  return jsonOk(configs);
});
