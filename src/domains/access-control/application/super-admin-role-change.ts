import { BusinessError } from '@/shared/lib/errors';

type SuperAdminRoleChangeDeps = {
  listRoles: (args: {
    includeDeleted: boolean;
  }) => Promise<Array<{ id: string; name: string }>>;
  checkUserRole: (userId: string, roleName: string) => Promise<boolean>;
};

export async function assertSuperAdminRoleChangeAllowed(
  input: {
    actorUserId: string;
    targetUserId: string;
    requestedRoleIds: string[];
    superAdminRoleName: string;
  },
  deps: SuperAdminRoleChangeDeps
) {
  const roles = await deps.listRoles({ includeDeleted: true });
  const superAdminRole = roles.find(
    (role) => role.name === input.superAdminRoleName
  );
  const grantsSuperAdmin =
    superAdminRole !== undefined &&
    input.requestedRoleIds.includes(superAdminRole.id);
  const targetIsSuperAdmin = await deps.checkUserRole(
    input.targetUserId,
    input.superAdminRoleName
  );

  if (!grantsSuperAdmin && !targetIsSuperAdmin) {
    return;
  }

  const actorIsSuperAdmin = await deps.checkUserRole(
    input.actorUserId,
    input.superAdminRoleName
  );
  if (!actorIsSuperAdmin) {
    throw new BusinessError('only super_admin can change the super_admin role');
  }
}
