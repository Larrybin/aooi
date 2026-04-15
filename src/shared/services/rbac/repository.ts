import { and, eq, gt, isNull, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  buildPublicPermissionMisconfigurationError,
  buildRoleDeletedAtMissingHint,
  isMissingRoleDeletedAtColumnError,
} from '@/core/db/schema-check';
import { permission, role, rolePermission, userRole } from '@/config/db/schema';
import { BusinessError } from '@/shared/lib/errors';
import { getUuid } from '@/shared/lib/hash';
import { logger } from '@/shared/lib/logger.server';

export type RbacAuditContext = {
  actorUserId?: string;
  source?: string;
  requestId?: string;
  route?: string;
};

type DbClient = ReturnType<typeof db>;
type DbTransactionClient = Parameters<
  Parameters<DbClient['transaction']>[0]
>[0];
type DbReadWriteClient = DbClient | DbTransactionClient;

export function getRbacAuditLogger(audit?: RbacAuditContext) {
  if (!audit) return logger;
  const { actorUserId, ...ctx } = audit;
  return logger.with({ ...ctx, actorUserId });
}

// DB inferred types
export type RoleRecord = typeof role.$inferSelect;
export type PermissionRecord = typeof permission.$inferSelect;
export type RolePermissionRecord = typeof rolePermission.$inferSelect;
export type UserRoleRecord = typeof userRole.$inferSelect;

export type NewRoleRecord = typeof role.$inferInsert;
export type NewPermissionRecord = typeof permission.$inferInsert;
export type NewRolePermissionRecord = typeof rolePermission.$inferInsert;
export type NewUserRoleRecord = typeof userRole.$inferInsert;

export type UpdateRoleRecord = Partial<Omit<RoleRecord, 'id' | 'createdAt'>>;
export type UpdatePermissionRecord = Partial<
  Omit<PermissionRecord, 'id' | 'createdAt'>
>;
export type UpdateRolePermissionRecord = Partial<
  Omit<RolePermissionRecord, 'id' | 'createdAt'>
>;
export type UpdateUserRoleRecord = Partial<
  Omit<UserRoleRecord, 'id' | 'createdAt'>
>;

export const RBAC_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export enum RbacRoleStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

export function normalizeRbacSchemaError(error: unknown): never {
  if (!isMissingRoleDeletedAtColumnError(error)) {
    throw error;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const hint = buildRoleDeletedAtMissingHint();

  logger.error('[rbac] schema mismatch detected', {
    pgCode: '42703',
    missingColumn: 'public.role.deleted_at',
    hint,
  });

  if (isProduction) {
    throw buildPublicPermissionMisconfigurationError();
  }

  throw new Error(hint);
}

export function buildActiveUserRoleWhereClause(userId: string, now: Date) {
  return and(
    eq(userRole.userId, userId),
    eq(role.status, RbacRoleStatus.ACTIVE),
    isNull(role.deletedAt),
    or(isNull(userRole.expiresAt), gt(userRole.expiresAt, now))
  );
}

async function assertWildcardPermissionAssignmentAllowed(
  tx: DbReadWriteClient,
  roleId: string,
  permissionIds: readonly string[],
  audit?: RbacAuditContext
): Promise<void> {
  if (permissionIds.length === 0) return;

  const [wildcard] = await tx
    .select({ id: permission.id })
    .from(permission)
    .where(eq(permission.code, '*'));
  const wildcardId = wildcard?.id;
  if (!wildcardId) return;
  if (!permissionIds.includes(wildcardId)) return;

  const [roleRow] = await tx
    .select({ name: role.name })
    .from(role)
    .where(and(eq(role.id, roleId), isNull(role.deletedAt)));
  if (!roleRow) {
    throw new BusinessError('role not found');
  }

  if (roleRow.name !== RBAC_ROLES.SUPER_ADMIN) {
    getRbacAuditLogger(audit).warn(
      '[rbac] blocked wildcard permission assignment',
      {
        roleId,
        roleName: roleRow.name,
      }
    );
    throw new BusinessError('wildcard permission is reserved for super_admin');
  }
}

export async function listRoles(): Promise<RoleRecord[]> {
  return await db()
    .select()
    .from(role)
    .where(and(eq(role.status, RbacRoleStatus.ACTIVE), isNull(role.deletedAt)));
}

export async function findRoleById(
  roleId: string
): Promise<RoleRecord | undefined> {
  const [result] = await db()
    .select()
    .from(role)
    .where(and(eq(role.id, roleId), isNull(role.deletedAt)));
  return result;
}

export async function findRoleByName(
  name: string
): Promise<RoleRecord | undefined> {
  const [result] = await db()
    .select()
    .from(role)
    .where(and(eq(role.name, name), isNull(role.deletedAt)));
  return result;
}

export async function createRoleRecord(
  newRole: NewRoleRecord,
  audit?: RbacAuditContext
): Promise<RoleRecord> {
  const [result] = await db().insert(role).values(newRole).returning();
  if (!result) {
    throw new Error('failed to create role');
  }
  getRbacAuditLogger(audit).info('[rbac] role created', {
    roleId: result.id,
    roleName: result.name,
  });
  return result;
}

export async function updateRoleRecord(
  roleId: string,
  updates: UpdateRoleRecord,
  audit?: RbacAuditContext
): Promise<RoleRecord | undefined> {
  const [result] = await db()
    .update(role)
    .set(updates)
    .where(and(eq(role.id, roleId), isNull(role.deletedAt)))
    .returning();
  if (!result) {
    getRbacAuditLogger(audit).warn('[rbac] role update missed', {
      roleId,
      changes: Object.keys(updates),
    });
    return undefined;
  }
  getRbacAuditLogger(audit).info('[rbac] role updated', {
    roleId: result.id,
    changes: Object.keys(updates),
  });
  return result;
}

export async function softDeleteRole(
  roleId: string,
  audit?: RbacAuditContext
): Promise<void> {
  await db()
    .update(role)
    .set({
      deletedAt: new Date(),
    })
    .where(and(eq(role.id, roleId), isNull(role.deletedAt)));
  getRbacAuditLogger(audit).info('[rbac] role deleted', { roleId });
}

export async function restoreRoleRecord(
  roleId: string,
  audit?: RbacAuditContext
): Promise<void> {
  await db()
    .update(role)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(role.id, roleId));
  getRbacAuditLogger(audit).info('[rbac] role restored', { roleId });
}

export async function listPermissions(): Promise<PermissionRecord[]> {
  return await db().select().from(permission);
}

export async function findPermissionByCode(
  code: string
): Promise<PermissionRecord | undefined> {
  const [result] = await db()
    .select()
    .from(permission)
    .where(eq(permission.code, code));
  return result;
}

export async function createPermissionRecord(
  newPermission: NewPermissionRecord
): Promise<PermissionRecord> {
  const [result] = await db()
    .insert(permission)
    .values(newPermission)
    .returning();
  if (!result) {
    throw new Error('failed to create permission');
  }
  return result;
}

export async function listRolePermissions(
  roleId: string
): Promise<PermissionRecord[]> {
  const result = await db()
    .select({
      id: permission.id,
      code: permission.code,
      resource: permission.resource,
      action: permission.action,
      title: permission.title,
      description: permission.description,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(eq(rolePermission.roleId, roleId));

  return result;
}

export async function addPermissionToRole(
  roleId: string,
  permissionId: string,
  audit?: RbacAuditContext
): Promise<RolePermissionRecord> {
  await assertWildcardPermissionAssignmentAllowed(
    db(),
    roleId,
    [permissionId],
    audit
  );
  const [result] = await db()
    .insert(rolePermission)
    .values({
      id: getUuid(),
      roleId,
      permissionId,
    })
    .returning();
  if (!result) {
    throw new Error('failed to assign permission to role');
  }
  getRbacAuditLogger(audit).info('[rbac] role permission assigned', {
    roleId,
    permissionId,
  });
  return result;
}

export async function removePermissionFromRole(
  roleId: string,
  permissionId: string,
  audit?: RbacAuditContext
): Promise<void> {
  await db()
    .delete(rolePermission)
    .where(
      and(
        eq(rolePermission.roleId, roleId),
        eq(rolePermission.permissionId, permissionId)
      )
    );
  getRbacAuditLogger(audit).info('[rbac] role permission removed', {
    roleId,
    permissionId,
  });
}

export async function replaceRolePermissions(
  roleId: string,
  permissionIds: string[],
  audit?: RbacAuditContext
): Promise<void> {
  const uniquePermissionIds = Array.from(new Set(permissionIds));

  await db().transaction(async (tx) => {
    await assertWildcardPermissionAssignmentAllowed(
      tx,
      roleId,
      uniquePermissionIds,
      audit
    );

    await tx.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

    if (uniquePermissionIds.length > 0) {
      await tx.insert(rolePermission).values(
        uniquePermissionIds.map((permissionId) => ({
          id: getUuid(),
          roleId,
          permissionId,
        }))
      );
    }
  });

  getRbacAuditLogger(audit).info('[rbac] role permissions replaced', {
    roleId,
    permissionCount: uniquePermissionIds.length,
  });
}

export async function listUserRoles(userId: string): Promise<RoleRecord[]> {
  const now = new Date();
  const result = await db()
    .select({
      id: role.id,
      name: role.name,
      title: role.title,
      description: role.description,
      status: role.status,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      sort: role.sort,
      deletedAt: role.deletedAt,
    })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .where(buildActiveUserRoleWhereClause(userId, now));

  return result;
}

export async function listUserPermissions(
  userId: string
): Promise<PermissionRecord[]> {
  const now = new Date();
  return await db()
    .selectDistinct({
      id: permission.id,
      code: permission.code,
      resource: permission.resource,
      action: permission.action,
      title: permission.title,
      description: permission.description,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(buildActiveUserRoleWhereClause(userId, now));
}

export async function readUserPermissionCodes(userId: string): Promise<string[]> {
  const now = new Date();
  try {
    const result = await db()
      .selectDistinct({ code: permission.code })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(buildActiveUserRoleWhereClause(userId, now));

    return result.map((row) => row.code);
  } catch (error: unknown) {
    normalizeRbacSchemaError(error);
  }
}

export async function addRoleToUser(
  userId: string,
  roleId: string,
  updatedAt?: Date,
  audit?: RbacAuditContext
): Promise<UserRoleRecord> {
  const [result] = await db()
    .insert(userRole)
    .values({
      id: getUuid(),
      userId,
      roleId,
      updatedAt,
    })
    .returning();
  if (!result) {
    throw new Error('failed to assign role to user');
  }
  getRbacAuditLogger(audit).info('[rbac] user role assigned', {
    userId,
    roleId,
  });
  return result;
}

export async function removeRoleFromUser(
  userId: string,
  roleId: string,
  audit?: RbacAuditContext
): Promise<void> {
  await db()
    .delete(userRole)
    .where(and(eq(userRole.userId, userId), eq(userRole.roleId, roleId)));
  getRbacAuditLogger(audit).info('[rbac] user role removed', {
    userId,
    roleId,
  });
}

export async function replaceUserRoles(
  userId: string,
  roleIds: string[],
  audit?: RbacAuditContext
): Promise<void> {
  await db().transaction(async (tx) => {
    await tx.delete(userRole).where(eq(userRole.userId, userId));

    if (roleIds.length > 0) {
      await tx.insert(userRole).values(
        roleIds.map((roleId) => ({
          id: getUuid(),
          userId,
          roleId,
        }))
      );
    }
  });
  getRbacAuditLogger(audit).info('[rbac] user roles replaced', {
    userId,
    roleCount: roleIds.length,
  });
}

export async function listUserIdsByRole(roleId: string): Promise<string[]> {
  const result = await db()
    .select({ userId: userRole.userId })
    .from(userRole)
    .where(eq(userRole.roleId, roleId));

  return result.map((row) => row.userId);
}
