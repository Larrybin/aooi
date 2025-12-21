/**
 * better-auth onError callback context
 * @see https://www.better-auth.com/docs/concepts/client
 */
export interface AuthErrorContext {
  error: {
    message?: string;
    status?: number;
  };
}
