import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { readSelfUserDetails } from '@/shared/services/self-user-details.server';

export const POST = withApi(async (req: Request) => {
  const user = await createApiContext(req).requireUser();
  const details = await readSelfUserDetails(user.id);

  return jsonOk(details, { headers: { 'Cache-Control': 'no-store' } });
});
