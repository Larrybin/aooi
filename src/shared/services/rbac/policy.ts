import {
  and,
  eq,
  exists,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/core/db';
import { permission, role, rolePermission, userRole } from '@/config/db/schema';

import {
  buildPermissionMatchCandidates,
  matchesPermissionCode,
} from './matcher';
import {
  buildActiveUserRoleWhereClause,
  listUserRoles,
  readUserPermissionCodes,
} from './repository';

function toPermissionCodeSet(permissionCodes: string[]): ReadonlySet<string> {
  return new Set(permissionCodes);
}

export async function checkUserPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const permissionCodeSet = toPermissionCodeSet(
    await readUserPermissionCodes(userId)
  );
  return matchesPermissionCode(permissionCodeSet, permissionCode);
}

export async function checkUserHasAnyPermissions(
  userId: string,
  permissionCodes: string[]
): Promise<boolean> {
  if (permissionCodes.length === 0) {
    return false;
  }

  const permissionCodeSet = toPermissionCodeSet(
    await readUserPermissionCodes(userId)
  );
  return permissionCodes.some((code) =>
    matchesPermissionCode(permissionCodeSet, code)
  );
}

export async function checkUserHasAllPermissions(
  userId: string,
  permissionCodes: string[]
): Promise<boolean> {
  if (permissionCodes.length === 0) {
    return true;
  }

  const permissionCodeSet = toPermissionCodeSet(
    await readUserPermissionCodes(userId)
  );
  return permissionCodes.every((code) =>
    matchesPermissionCode(permissionCodeSet, code)
  );
}

export async function checkUserRole(
  userId: string,
  roleName: string
): Promise<boolean> {
  const roles = await listUserRoles(userId);
  return roles.some((roleRecord) => roleRecord.name === roleName);
}

export async function checkUserHasAnyRoles(
  userId: string,
  roleNames: string[]
): Promise<boolean> {
  const roles = await listUserRoles(userId);
  const userRoleNames = roles.map((roleRecord) => roleRecord.name);
  return roleNames.some((name) => userRoleNames.includes(name));
}

export function buildPermissionGuardCondition(params: {
  userId: string;
  permissionCode: string;
  now?: Date;
}): SQL {
  const now = params.now ?? new Date();
  const candidates = buildPermissionMatchCandidates(params.permissionCode);

  const subquery = db()
    .select({ userId: userRole.userId })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(
      and(
        buildActiveUserRoleWhereClause(params.userId, now),
        inArray(permission.code, candidates)
      )
    )
    .limit(1);

  return exists(subquery);
}

export function buildAnyPermissionGuardCondition(params: {
  userId: string;
  permissionCodes: string[];
  now?: Date;
}): SQL {
  if (params.permissionCodes.length === 0) {
    return sql`false`;
  }
  const now = params.now ?? new Date();
  return or(
    ...params.permissionCodes.map((code) =>
      buildPermissionGuardCondition({
        userId: params.userId,
        permissionCode: code,
        now,
      })
    )
  ) as SQL;
}

export function buildAllPermissionGuardCondition(params: {
  userId: string;
  permissionCodes: string[];
  now?: Date;
}): SQL | undefined {
  if (params.permissionCodes.length === 0) {
    return;
  }
  const now = params.now ?? new Date();
  return and(
    ...params.permissionCodes.map((code) =>
      buildPermissionGuardCondition({
        userId: params.userId,
        permissionCode: code,
        now,
      })
    )
  ) as SQL;
}
