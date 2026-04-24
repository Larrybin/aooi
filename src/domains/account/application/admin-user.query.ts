export async function readAdminUserQuery(
  userId: string,
  deps: {
    findUserById: (id: string) => Promise<
      | {
          id: string;
          email?: string | null;
          name?: string | null;
          image?: string | null;
          createdAt?: Date | null;
        }
      | undefined
    >;
  }
) {
  return deps.findUserById(userId);
}
