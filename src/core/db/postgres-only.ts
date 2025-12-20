export function assertPostgresOnlyDatabaseProvider(
  provider: string | undefined
): void {
  if (!provider) return;
  if (provider === 'postgresql') return;

  throw new Error(
    `Unsupported DATABASE_PROVIDER: ${provider}. This project currently supports postgresql only.`
  );
}

