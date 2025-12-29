import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRemainingCreditsSummary } from '@/shared/models/credit';
import { hasPermission } from '@/shared/services/rbac';

export const POST = withApi(async (req: Request) => {
  const user = await createApiContext(req).requireUser();

  const isAdmin = await hasPermission(user.id, PERMISSIONS.ADMIN_ACCESS);
  const credits = await getRemainingCreditsSummary(user.id);

  return jsonOk(
    {
      ...user,
      isAdmin,
      credits,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
