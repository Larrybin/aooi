import { matchesPermissionCode } from './matcher';
import { readUserPermissionCodes } from './repository';

export type RbacChecker = {
  has: (permissionCode: string) => Promise<boolean>;
  hasAny: (permissionCodes: string[]) => Promise<boolean>;
  hasAll: (permissionCodes: string[]) => Promise<boolean>;
};

export function createRbacChecker(userId: string): RbacChecker {
  let permissionCodeSetPromise: Promise<ReadonlySet<string>> | null = null;

  const getPermissionCodeSet = async () => {
    if (!permissionCodeSetPromise) {
      permissionCodeSetPromise = readUserPermissionCodes(userId).then(
        (permissionCodes) => new Set(permissionCodes)
      );
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
