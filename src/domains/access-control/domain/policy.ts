import {
  buildPermissionMatchCandidates,
  matchesPermissionCode,
} from './permission-matcher';

export {
  buildPermissionMatchCandidates,
  matchesPermissionCode,
} from './permission-matcher';

export function hasPermission(
  permissionCodes: readonly string[],
  permissionCode: string
): boolean {
  return matchesPermissionCode(new Set(permissionCodes), permissionCode);
}

export function hasAnyPermission(
  permissionCodes: readonly string[],
  requiredPermissionCodes: readonly string[]
): boolean {
  if (requiredPermissionCodes.length === 0) {
    return false;
  }

  const permissionCodeSet = new Set(permissionCodes);
  return requiredPermissionCodes.some((code) =>
    matchesPermissionCode(permissionCodeSet, code)
  );
}

export function hasAllPermissions(
  permissionCodes: readonly string[],
  requiredPermissionCodes: readonly string[]
): boolean {
  if (requiredPermissionCodes.length === 0) {
    return true;
  }

  const permissionCodeSet = new Set(permissionCodes);
  return requiredPermissionCodes.every((code) =>
    matchesPermissionCode(permissionCodeSet, code)
  );
}

export function hasAnyRole(
  roleNames: readonly string[],
  requiredRoleNames: readonly string[]
): boolean {
  if (requiredRoleNames.length === 0) {
    return false;
  }

  return requiredRoleNames.some((roleName) => roleNames.includes(roleName));
}

export function hasRole(
  roleNames: readonly string[],
  requiredRoleName: string
): boolean {
  return roleNames.includes(requiredRoleName);
}

export function getPermissionMatchCandidates(permissionCode: string): string[] {
  return buildPermissionMatchCandidates(permissionCode);
}
