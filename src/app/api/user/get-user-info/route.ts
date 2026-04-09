import { hasPermission } from '@/core/rbac';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRemainingCreditsSummary } from '@/shared/models/credit';
import { getCurrentSubscription } from '@/shared/models/subscription';

export const POST = withApi(async (req: Request) => {
  const user = await createApiContext(req).requireUser();

  const isAdmin = await hasPermission(user.id, PERMISSIONS.ADMIN_ACCESS);
  const credits = await getRemainingCreditsSummary(user.id);
  const currentSubscription = await getCurrentSubscription(user.id);

  return jsonOk(
    {
      ...user,
      isAdmin,
      credits,
      currentSubscriptionProductId: currentSubscription?.productId,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
