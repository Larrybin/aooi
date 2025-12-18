import { requireUser } from '@/shared/lib/api/guard';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRemainingCredits } from '@/shared/models/credit';
import { hasPermission } from '@/shared/services/rbac';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export const POST = withApi(async () => {
  const user = await requireUser();

  const isAdmin = await hasPermission(user.id, PERMISSIONS.ADMIN_ACCESS);
  const remainingCredits = await getRemainingCredits(user.id);

  return jsonOk({
    ...user,
    isAdmin,
    credits: { remainingCredits, expiresAt: null },
  });
});
