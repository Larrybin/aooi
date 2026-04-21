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

export type AccessControlRoleRecord = {
  id: string;
  name: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
};

export type AccessControlPermissionRecord = {
  id: string;
  code: string;
  resource?: string | null;
  action?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type AccessControlAuditInput = {
  actorUserId?: string;
  source?: string;
};

export type AccessControlAdminReadDeps = {
  listRoles: (args?: {
    includeDeleted?: boolean;
  }) => Promise<AccessControlRoleRecord[]>;
  findRoleById: (
    roleId: string,
    args?: {
      includeDeleted?: boolean;
    }
  ) => Promise<AccessControlRoleRecord | undefined>;
  listPermissions: () => Promise<AccessControlPermissionRecord[]>;
  listRolePermissions: (
    roleId: string
  ) => Promise<AccessControlPermissionRecord[]>;
  listUserRolesDetailed: (
    userId: string
  ) => Promise<Array<{ id: string; title?: string | null }>>;
};

export type AccessControlAdminMutationDeps = {
  updateRoleRecord: (
    roleId: string,
    updates: {
      title?: string;
      description?: string;
    },
    audit?: AccessControlAuditInput
  ) => Promise<AccessControlRoleRecord | undefined>;
  replaceRolePermissions: (
    roleId: string,
    permissionIds: string[],
    audit?: AccessControlAuditInput
  ) => Promise<void>;
  softDeleteRole: (
    roleId: string,
    audit?: AccessControlAuditInput
  ) => Promise<void>;
  restoreRoleRecord: (
    roleId: string,
    audit?: AccessControlAuditInput
  ) => Promise<
    | { status: 'restored' }
    | { status: 'name_conflict' }
  >;
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

export async function listAdminRolesUseCase(
  input: { includeDeleted?: boolean },
  deps: Pick<AccessControlAdminReadDeps, 'listRoles'>
) {
  return deps.listRoles({ includeDeleted: input.includeDeleted });
}

export async function listAdminPermissionsUseCase(
  deps: Pick<AccessControlAdminReadDeps, 'listPermissions'>
) {
  return deps.listPermissions();
}

export async function readAdminRoleUseCase(
  roleId: string,
  deps: Pick<AccessControlAdminReadDeps, 'findRoleById'>
) {
  return deps.findRoleById(roleId, { includeDeleted: true });
}

export async function readAdminRoleDetailUseCase(
  roleId: string,
  deps: Pick<
    AccessControlAdminReadDeps,
    'findRoleById' | 'listPermissions' | 'listRolePermissions'
  >
) {
  const role = await deps.findRoleById(roleId, { includeDeleted: true });
  if (!role) {
    return null;
  }

  const [permissions, rolePermissions] = await Promise.all([
    deps.listPermissions(),
    deps.listRolePermissions(roleId),
  ]);

  return {
    role,
    permissions,
    rolePermissions,
  };
}

export async function readAdminUserRoleOptionsUseCase(
  userId: string,
  deps: Pick<AccessControlAdminReadDeps, 'listRoles' | 'listUserRolesDetailed'>
) {
  const [roles, userRoles] = await Promise.all([
    deps.listRoles(),
    deps.listUserRolesDetailed(userId),
  ]);

  return {
    roles,
    userRoles,
  };
}

export async function updateRoleMetadataUseCase(
  input: {
    roleId: string;
    title: string;
    description: string;
    actorUserId: string;
    source: string;
  },
  deps: Pick<
    AccessControlAdminReadDeps,
    'findRoleById'
  > &
    Pick<AccessControlAdminMutationDeps, 'updateRoleRecord'>
) {
  const role = await deps.findRoleById(input.roleId);
  if (!role) {
    return null;
  }

  return deps.updateRoleRecord(
    input.roleId,
    {
      title: input.title,
      description: input.description,
    },
    {
      actorUserId: input.actorUserId,
      source: input.source,
    }
  );
}

export async function replaceRolePermissionsUseCase(
  input: {
    roleId: string;
    permissionIds: string[];
    actorUserId: string;
    source: string;
  },
  deps: Pick<
    AccessControlAdminReadDeps,
    'findRoleById'
  > &
    Pick<AccessControlAdminMutationDeps, 'replaceRolePermissions'>
) {
  const role = await deps.findRoleById(input.roleId);
  if (!role) {
    return null;
  }

  await deps.replaceRolePermissions(input.roleId, input.permissionIds, {
    actorUserId: input.actorUserId,
    source: input.source,
  });

  return role;
}

export async function deleteRoleUseCase(
  input: {
    roleId: string;
    actorUserId: string;
    source: string;
  },
  deps: Pick<
    AccessControlAdminReadDeps,
    'findRoleById'
  > &
    Pick<AccessControlAdminMutationDeps, 'softDeleteRole'>
) {
  const role = await deps.findRoleById(input.roleId);
  if (!role || role.deletedAt) {
    return null;
  }

  await deps.softDeleteRole(input.roleId, {
    actorUserId: input.actorUserId,
    source: input.source,
  });

  return role;
}

export async function restoreRoleUseCase(
  input: {
    roleId: string;
    actorUserId: string;
    source: string;
  },
  deps: Pick<
    AccessControlAdminReadDeps,
    'findRoleById'
  > &
    Pick<AccessControlAdminMutationDeps, 'restoreRoleRecord'>
) {
  const role = await deps.findRoleById(input.roleId, { includeDeleted: true });
  if (!role) {
    return { status: 'not_found' } as const;
  }
  if (!role.deletedAt) {
    return { status: 'not_deleted' } as const;
  }

  const restoreResult = await deps.restoreRoleRecord(input.roleId, {
    actorUserId: input.actorUserId,
    source: input.source,
  });
  if (restoreResult.status === 'name_conflict') {
    return { status: 'name_conflict' } as const;
  }

  return { status: 'restored', role } as const;
}

export {
  getPermissionMatchCandidates,
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
};
