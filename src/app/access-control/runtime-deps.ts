import {
  checkUserHasAllPermissions,
  checkUserHasAnyPermissions,
  checkUserHasAnyRoles,
  checkUserPermission,
  checkUserRole,
  createPermissionCheckerCache,
  type AccessControlRepository,
} from '@/domains/access-control/application/checker';
import {
  ACCESS_CONTROL_ROLES,
  AccessControlRoleStatus,
  addPermissionToRole,
  addRoleToUser,
  buildAllPermissionGuardCondition,
  buildAnyPermissionGuardCondition,
  buildPermissionGuardCondition,
  createPermissionRecord,
  createRoleRecord,
  findPermissionByCode,
  findRoleById,
  findRoleByIdIncludingDeleted,
  findRoleByName,
  getAccessControlAuditLogger,
  listPermissions,
  listRolePermissions,
  listRoles,
  listRolesIncludingDeleted,
  listUserIdsByRole,
  listUserPermissions,
  listUserRoles,
  normalizeAccessControlSchemaError,
  readUserPermissionCodes,
  removePermissionFromRole,
  removeRoleFromUser,
  replaceRolePermissions,
  replaceUserRoles,
  restoreRoleRecord,
  softDeleteRole,
  updateRoleRecord,
} from '@/infra/adapters/access-control/repository';

export const accessControlRepository: AccessControlRepository = {
  readUserPermissionCodes,
  listUserRoles,
};

export const getPermissionCheckerForRequest = createPermissionCheckerCache(
  accessControlRepository
);

export const accessControlRuntimeDeps = {
  readUserPermissionCodes,
  listUserRoles,
  listUserRolesDetailed: listUserRoles,
  checkUserPermission: (userId: string, code: string) =>
    checkUserPermission(userId, code, accessControlRepository),
  checkUserHasAnyPermissions: (userId: string, codes: string[]) =>
    checkUserHasAnyPermissions(userId, codes, accessControlRepository),
  checkUserHasAllPermissions: (userId: string, codes: string[]) =>
    checkUserHasAllPermissions(userId, codes, accessControlRepository),
  checkUserRole: (userId: string, roleName: string) =>
    checkUserRole(userId, roleName, accessControlRepository),
  checkUserHasAnyRoles: (userId: string, roleNames: string[]) =>
    checkUserHasAnyRoles(userId, roleNames, accessControlRepository),
  buildPermissionGuardCondition,
  buildAnyPermissionGuardCondition,
  buildAllPermissionGuardCondition,
  getPermissionCheckerForRequest,
  listRoles: async ({ includeDeleted }: { includeDeleted?: boolean } = {}) =>
    includeDeleted ? listRolesIncludingDeleted() : listRoles(),
  findRoleById: async (
    roleId: string,
    options?: {
      includeDeleted?: boolean;
    }
  ) =>
    options?.includeDeleted
      ? findRoleByIdIncludingDeleted(roleId)
      : findRoleById(roleId),
  findRoleByName,
  createRoleRecord,
  updateRoleRecord,
  softDeleteRole,
  restoreRoleRecord,
  listPermissions,
  findPermissionByCode,
  createPermissionRecord,
  listRolePermissions,
  addPermissionToRole,
  removePermissionFromRole,
  replaceRolePermissions,
  addRoleToUser,
  removeRoleFromUser,
  replaceUserRoles,
  listUserIdsByRole,
  listUserPermissions,
  getAccessControlAuditLogger,
  normalizeAccessControlSchemaError,
  ACCESS_CONTROL_ROLES,
  AccessControlRoleStatus,
};
