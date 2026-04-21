import { cache } from 'react';

import {
  getPermissionMatchCandidates,
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
} from '../domain/policy';

export type AccessControlChecker = {
  has: (permissionCode: string) => Promise<boolean>;
  hasAny: (permissionCodes: string[]) => Promise<boolean>;
  hasAll: (permissionCodes: string[]) => Promise<boolean>;
};

export type AccessControlRepository = {
  readUserPermissionCodes: (userId: string) => Promise<string[]>;
  listUserRoles: (userId: string) => Promise<Array<{ name: string }>>;
};

export function createAccessControlChecker(
  userId: string,
  repository: Pick<AccessControlRepository, 'readUserPermissionCodes'>
): AccessControlChecker {
  let permissionCodeSetPromise: Promise<ReadonlySet<string>> | null = null;

  const getPermissionCodeSet = async () => {
    if (!permissionCodeSetPromise) {
      permissionCodeSetPromise = repository
        .readUserPermissionCodes(userId)
        .then((permissionCodes) => new Set(permissionCodes));
    }
    return await permissionCodeSetPromise;
  };

  return {
    has: async (permissionCode: string): Promise<boolean> => {
      const permissionCodeSet = await getPermissionCodeSet();
      return hasPermission(Array.from(permissionCodeSet), permissionCode);
    },
    hasAny: async (permissionCodes: string[]): Promise<boolean> => {
      const permissionCodeSet = await getPermissionCodeSet();
      return hasAnyPermission(Array.from(permissionCodeSet), permissionCodes);
    },
    hasAll: async (permissionCodes: string[]): Promise<boolean> => {
      const permissionCodeSet = await getPermissionCodeSet();
      return hasAllPermissions(Array.from(permissionCodeSet), permissionCodes);
    },
  };
}

export function createPermissionCheckerCache(
  repository: Pick<AccessControlRepository, 'readUserPermissionCodes'>
) {
  return cache((userId: string) => createAccessControlChecker(userId, repository));
}

export async function checkUserPermission(
  userId: string,
  permissionCode: string,
  repository: Pick<AccessControlRepository, 'readUserPermissionCodes'>
): Promise<boolean> {
  const permissionCodes = await repository.readUserPermissionCodes(userId);
  return hasPermission(permissionCodes, permissionCode);
}

export async function checkUserHasAnyPermissions(
  userId: string,
  permissionCodes: string[],
  repository: Pick<AccessControlRepository, 'readUserPermissionCodes'>
): Promise<boolean> {
  const userPermissionCodes = await repository.readUserPermissionCodes(userId);
  return hasAnyPermission(userPermissionCodes, permissionCodes);
}

export async function checkUserHasAllPermissions(
  userId: string,
  permissionCodes: string[],
  repository: Pick<AccessControlRepository, 'readUserPermissionCodes'>
): Promise<boolean> {
  const userPermissionCodes = await repository.readUserPermissionCodes(userId);
  return hasAllPermissions(userPermissionCodes, permissionCodes);
}

export async function checkUserRole(
  userId: string,
  roleName: string,
  repository: Pick<AccessControlRepository, 'listUserRoles'>
): Promise<boolean> {
  const userRoles = await repository.listUserRoles(userId);
  return hasRole(
    userRoles.map((role) => role.name),
    roleName
  );
}

export async function checkUserHasAnyRoles(
  userId: string,
  roleNames: string[],
  repository: Pick<AccessControlRepository, 'listUserRoles'>
): Promise<boolean> {
  const userRoles = await repository.listUserRoles(userId);
  return hasAnyRole(
    userRoles.map((role) => role.name),
    roleNames
  );
}

export {
  getPermissionMatchCandidates,
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
};
