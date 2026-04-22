import {
  listAdminPermissionsUseCase,
  listAdminRolesUseCase,
  readAdminRoleDetailUseCase,
  readAdminRoleUseCase,
  type AccessControlAdminReadDeps,
  type AccessControlPermissionRecord,
  type AccessControlRoleRecord,
} from './checker';

export type AdminRoleRow = AccessControlRoleRecord;
export type AdminPermissionRow = AccessControlPermissionRecord;

export async function listAdminRolesQuery(
  input: { includeDeleted?: boolean },
  deps: Pick<AccessControlAdminReadDeps, 'listRoles'>
) {
  const rows = await listAdminRolesUseCase(input, deps);
  return { rows };
}

export async function listAdminPermissionsQuery(
  deps: Pick<AccessControlAdminReadDeps, 'listPermissions'>
) {
  const rows = await listAdminPermissionsUseCase(deps);
  return { rows };
}

export async function readAdminRoleQuery(
  roleId: string,
  deps: Pick<AccessControlAdminReadDeps, 'findRoleById'>
) {
  return readAdminRoleUseCase(roleId, deps);
}

export async function readAdminRolePermissionsQuery(
  roleId: string,
  deps: Pick<
    AccessControlAdminReadDeps,
    'findRoleById' | 'listPermissions' | 'listRolePermissions'
  >
) {
  return readAdminRoleDetailUseCase(roleId, deps);
}
