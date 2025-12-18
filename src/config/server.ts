import 'server-only';

export const serverEnv = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseProvider: process.env.DATABASE_PROVIDER ?? 'postgresql',
  dbSingletonEnabled: process.env.DB_SINGLETON_ENABLED ?? 'false',

  authBaseUrl:
    process.env.BETTER_AUTH_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000',
  authSecret:
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    '',
};
