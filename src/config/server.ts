import 'server-only';

import { assertPostgresOnlyDatabaseProvider } from '@/core/db/postgres-only';
import { resolveServerAuthBaseUrl } from './server-auth-base-url';

assertPostgresOnlyDatabaseProvider(process.env.DATABASE_PROVIDER);

export const serverEnv = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  dbSingletonEnabled: process.env.DB_SINGLETON_ENABLED ?? 'false',
  authBaseUrl: resolveServerAuthBaseUrl(),
  authSecret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET ?? '',
};
