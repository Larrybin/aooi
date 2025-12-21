import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getPublicConfigs } from '@/shared/models/config';

export const POST = withApi(async () => {
  const configs = await getPublicConfigs();
  return jsonOk(configs);
});
