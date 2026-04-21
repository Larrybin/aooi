import type { AccountAdminUserRecord } from './use-cases';
import { listAdminUsersUseCase } from './use-cases';

type AccountAdminUsersDeps = {
  getUsers: (params: {
    email?: string;
    page: number;
    limit: number;
  }) => Promise<AccountAdminUserRecord[]>;
  getUsersCount: (params: { email?: string }) => Promise<number>;
  getRemainingCredits: (userId: string) => Promise<number>;
  listUserRolesDetailed?: (
    userId: string
  ) => Promise<Array<{ id: string; title?: string | null }>>;
};

export async function listAdminUsersQuery(
  input: {
    email?: string;
    page: number;
    limit: number;
  },
  deps: AccountAdminUsersDeps
) {
  const result = await listAdminUsersUseCase(input, {
    ...deps,
    hasPermission: async () => true,
  });

  const rows = await Promise.all(
    result.rows.map(async (user) => ({
      ...user,
      roles: deps.listUserRolesDetailed
        ? await deps.listUserRolesDetailed(user.id)
        : (user.roles ?? []),
    }))
  );

  return {
    rows,
    total: result.total,
  };
}
