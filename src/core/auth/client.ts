import {
  oneTapClient,
  type GoogleOneTapOptions,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

type OneTapPlugin = NonNullable<
  Exclude<Parameters<typeof createAuthClient>[0], undefined>['plugins']
>[number];

const makeOneTapPlugin = (options: GoogleOneTapOptions): OneTapPlugin =>
  oneTapClient(options) as OneTapPlugin;

function getRuntimeAuthClientBaseURL(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.origin;
}

function shouldSerializeAuthBody(body: unknown): body is Record<string, unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  );
}

type AuthRequestContext = {
  body: unknown;
  headers: Headers;
};

type AuthJsonRequestOptions = Record<string, unknown> & {
  onRequest?: (context: AuthRequestContext) => unknown | Promise<unknown>;
};

export function withAuthJsonRequest<T extends AuthJsonRequestOptions>(options: T): T {
  const currentOnRequest = options.onRequest;

  return {
    ...options,
    async onRequest(context: AuthRequestContext) {
      if (shouldSerializeAuthBody(context.body)) {
        context.headers.set('content-type', 'application/json');
        context.body = JSON.stringify(context.body);
      }

      if (typeof currentOnRequest === 'function') {
        await currentOnRequest(context);
      }

      return context;
    },
  } as T;
}

// auth client for client-side use
export const authClient = createAuthClient({
  baseURL: getRuntimeAuthClientBaseURL(),
});

// export auth client methods
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;

// get auth client with configs
export function getAuthClient(configs: Record<string, string>) {
  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const plugins =
    isGoogleAuthEnabled &&
    configs.google_client_id &&
    configs.google_one_tap_enabled === 'true'
      ? [
          makeOneTapPlugin({
            clientId: configs.google_client_id,
            // Optional client configuration:
            autoSelect: false,
            cancelOnTapOutside: false,
            context: 'signin',
            additionalOptions: {
              // Any extra options for the Google initialize method
            },
            // Configure prompt behavior and exponential backoff:
            promptOptions: {
              baseDelay: 1000, // Base delay in ms (default: 1000)
              maxAttempts: 1, // Only attempt once to avoid multiple error logs (default: 5)
            },
          }),
        ]
      : [];

  const authClient = createAuthClient({
    baseURL: getRuntimeAuthClientBaseURL(),
    plugins,
  });

  return authClient;
}
