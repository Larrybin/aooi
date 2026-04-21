import { ServiceUnavailableError } from '@/shared/lib/api/errors';

export function assertPostgresOnlyDatabaseProvider(
  provider: string | undefined
): void {
  if (!provider) return;
  if (provider === 'postgresql') return;

  throw new ServiceUnavailableError(
    `Unsupported DATABASE_PROVIDER: ${provider}. This project currently supports postgresql only.`
  );
}
