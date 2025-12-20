import 'server-only';

import { and, eq, gt, isNull, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { permission, role, rolePermission, userRole } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { logger } from '@/shared/lib/logger.server';
import {
  buildPublicPermissionMisconfigurationError,
  buildRoleDeletedAtMissingHint,
  isMissingRoleDeletedAtColumnError,
} from '@/core/db/schema-check';

// Types
export type Role = typeof role.$inferSelect;
export type Permission = typeof permission.$inferSelect;
export type RolePermission = typeof rolePermission.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;

export type NewRole = typeof role.$inferInsert;
export type NewPermission = typeof permission.$inferInsert;
export type NewRolePermission = typeof rolePermission.$inferInsert;
export type NewUserRole = typeof userRole.$inferInsert;

export type UpdateRole = Partial<Omit<Role, 'id' | 'createdAt'>>;
export type UpdatePermission = Partial<Omit<Permission, 'id' | 'createdAt'>>;
export type UpdateRolePermission = Partial<
  Omit<RolePermission, 'id' | 'createdAt'>
>;
export type UpdateUserRole = Partial<Omit<UserRole, 'id' | 'createdAt'>>;

// Role constants
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export enum RoleStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

function normalizeRbacSchemaError(error: unknown): never {
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

function matchesPermissionCode(
  userPermissionCodes: ReadonlySet<string>,
  requiredPermissionCode: string
): boolean {
  if (userPermissionCodes.has('*')) {
    return true;
  }

  if (userPermissionCodes.has(requiredPermissionCode)) {
    return true;
  }

  const parts = requiredPermissionCode.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = `${parts.slice(0, i).join('.')}.*`;
    if (userPermissionCodes.has(wildcard)) {
      return true;
    }
  }

  return false;
}

function buildActiveUserRoleWhere(userId: string, now: Date) {
  return and(
    eq(userRole.userId, userId),
    eq(role.status, RoleStatus.ACTIVE),
    isNull(role.deletedAt),
    or(isNull(userRole.expiresAt), gt(userRole.expiresAt, now))
  );
}

/**
 * Get all roles
 */
export async function getRoles(): Promise<Role[]> {
  return await db()
    .select()
    .from(role)
    .where(and(eq(role.status, RoleStatus.ACTIVE), isNull(role.deletedAt)));
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<Role | undefined> {
  const [result] = await db()
    .select()
    .from(role)
    .where(and(eq(role.id, roleId), isNull(role.deletedAt)));
  return result;
}

/**
 * Get role by name
 */
export async function getRoleByName(name: string): Promise<Role | undefined> {
  const [result] = await db()
    .select()
    .from(role)
    .where(and(eq(role.name, name), isNull(role.deletedAt)));
  return result;
}

/**
 * Create a new role
 */
export async function createRole(newRole: NewRole): Promise<Role> {
  const [result] = await db().insert(role).values(newRole).returning();
  return result;
}

/**
 * Update a role
 */
export async function updateRole(
  roleId: string,
  updates: UpdateRole
): Promise<Role> {
  const [result] = await db()
    .update(role)
    .set(updates)
    .where(and(eq(role.id, roleId), isNull(role.deletedAt)))
    .returning();
  return result;
}

/**
 * Delete a role
 */
export async function deleteRole(roleId: string): Promise<void> {
  await db()
    .update(role)
    .set({
      deletedAt: new Date(),
    })
    .where(and(eq(role.id, roleId), isNull(role.deletedAt)));
}

/**
 * Get all permissions
 */
export async function getPermissions(): Promise<Permission[]> {
  return await db().select().from(permission);
}

/**
 * Get permission by code
 */
export async function getPermissionByCode(
  code: string
): Promise<Permission | undefined> {
  const [result] = await db()
    .select()
    .from(permission)
    .where(eq(permission.code, code));
  return result;
}

/**
 * Create a new permission
 */
export async function createPermission(
  newPermission: NewPermission
): Promise<Permission> {
  const [result] = await db()
    .insert(permission)
    .values(newPermission)
    .returning();
  return result;
}

/**
 * Get permissions for a role
 */
export async function getRolePermissions(
  roleId: string
): Promise<Permission[]> {
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

/**
 * Assign permission to role
 */
export async function assignPermissionToRole(
  roleId: string,
  permissionId: string
): Promise<RolePermission> {
  const [result] = await db()
    .insert(rolePermission)
    .values({
      id: getUuid(),
      roleId,
      permissionId,
    })
    .returning();
  return result;
}

/**
 * Remove permission from role
 */
export async function removePermissionFromRole(
  roleId: string,
  permissionId: string
): Promise<void> {
  await db()
    .delete(rolePermission)
    .where(
      and(
        eq(rolePermission.roleId, roleId),
        eq(rolePermission.permissionId, permissionId)
      )
    );
}

/**
 * Batch assign permissions to role
 */
export async function assignPermissionsToRole(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  // First, remove all existing permissions
  await db().delete(rolePermission).where(eq(rolePermission.roleId, roleId));

  // Then, add new permissions
  if (permissionIds.length > 0) {
    await db()
      .insert(rolePermission)
      .values(
        permissionIds.map((permissionId) => ({
          id: getUuid(),
          roleId,
          permissionId,
        }))
      );
  }
}

/**
 * Get user's roles
 */
export async function getUserRoles(userId: string): Promise<Role[]> {
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
    .where(buildActiveUserRoleWhere(userId, now));

  return result;
}

/**
 * Get user's permissions (through roles)
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
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
    .where(buildActiveUserRoleWhere(userId, now));
}

async function getUserPermissionCodes(userId: string): Promise<string[]> {
  const now = new Date();
  try {
    const result = await db()
      .selectDistinct({ code: permission.code })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(buildActiveUserRoleWhere(userId, now));

    return result.map((row) => row.code);
  } catch (error: unknown) {
    normalizeRbacSchemaError(error);
  }
}

async function getUserPermissionCodeSet(
  userId: string
): Promise<ReadonlySet<string>> {
  return new Set(await getUserPermissionCodes(userId));
}

export function createPermissionChecker(userId: string) {
  let permissionCodeSetPromise: Promise<ReadonlySet<string>> | null = null;

  const getPermissionCodeSet = async () => {
    if (!permissionCodeSetPromise) {
      permissionCodeSetPromise = getUserPermissionCodeSet(userId);
    }
    return await permissionCodeSetPromise;
  };

  return {
    has: async (permissionCode: string): Promise<boolean> => {
      const permissionCodeSet = await getPermissionCodeSet();
      return matchesPermissionCode(permissionCodeSet, permissionCode);
    },
    hasAny: async (permissionCodes: string[]): Promise<boolean> => {
      if (permissionCodes.length === 0) {
        return false;
      }
      const permissionCodeSet = await getPermissionCodeSet();
      return permissionCodes.some((code) =>
        matchesPermissionCode(permissionCodeSet, code)
      );
    },
    hasAll: async (permissionCodes: string[]): Promise<boolean> => {
      if (permissionCodes.length === 0) {
        return true;
      }
      const permissionCodeSet = await getPermissionCodeSet();
      return permissionCodes.every((code) =>
        matchesPermissionCode(permissionCodeSet, code)
      );
    },
  };
}

/**
 * Check if user has a specific permission
 * Supports wildcard matching (e.g., "admin.*", "admin.posts.*")
 */
export async function hasPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const permissionCodes = await getUserPermissionCodeSet(userId);
  return matchesPermissionCode(permissionCodes, permissionCode);
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissionCodes: string[]
): Promise<boolean> {
  if (permissionCodes.length === 0) {
    return false;
  }

  const userPermissionCodes = await getUserPermissionCodeSet(userId);
  return permissionCodes.some((code) =>
    matchesPermissionCode(userPermissionCodes, code)
  );
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissionCodes: string[]
): Promise<boolean> {
  if (permissionCodes.length === 0) {
    return true;
  }

  const userPermissionCodes = await getUserPermissionCodeSet(userId);
  return permissionCodes.every((code) =>
    matchesPermissionCode(userPermissionCodes, code)
  );
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.name === roleName);
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(
  userId: string,
  roleNames: string[]
): Promise<boolean> {
  const roles = await getUserRoles(userId);
  const userRoleNames = roles.map((r) => r.name);
  return roleNames.some((name) => userRoleNames.includes(name));
}

/**
 * Assign role to user
 */
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  updatedAt?: Date
): Promise<UserRole> {
  const [result] = await db()
    .insert(userRole)
    .values({
      id: getUuid(),
      userId,
      roleId,
      updatedAt,
    })
    .returning();
  return result;
}

/**
 * Remove role from user
 */
export async function removeRoleFromUser(
  userId: string,
  roleId: string
): Promise<void> {
  await db()
    .delete(userRole)
    .where(and(eq(userRole.userId, userId), eq(userRole.roleId, roleId)));
}

/**
 * Batch assign roles to user
 */
export async function assignRolesToUser(
  userId: string,
  roleIds: string[]
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
}

/**
 * Get users by role
 */
export async function getUsersByRole(roleId: string): Promise<string[]> {
  const result = await db()
    .select({ userId: userRole.userId })
    .from(userRole)
    .where(eq(userRole.roleId, roleId));

  return result.map((r) => r.userId);
}
