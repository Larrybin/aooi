import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRemainingCredits } from '@/shared/models/credit';

export const POST = withApi(async (req: Request) => {
  const user = await createApiContext(req).requireUser();

  const credits = await getRemainingCredits(user.id);

  return jsonOk({ remainingCredits: credits, expiresAt: null });
});
