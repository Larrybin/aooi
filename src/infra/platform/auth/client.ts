import type { AuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
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

function shouldSerializeAuthBody(
  body: unknown
): body is Record<string, unknown> {
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

export function withAuthJsonRequest<T extends AuthJsonRequestOptions>(
  options: T
): T {
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

export const authClient = createAuthClient({
  baseURL: getRuntimeAuthClientBaseURL(),
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;

export function getAuthClient(settings: AuthUiRuntimeSettings) {
  const isGoogleAuthEnabled = settings.googleAuthEnabled;
  const plugins =
    isGoogleAuthEnabled &&
    settings.googleClientId &&
    settings.googleOneTapEnabled
      ? [
          makeOneTapPlugin({
            clientId: settings.googleClientId,
            autoSelect: false,
            cancelOnTapOutside: false,
            context: 'signin',
            additionalOptions: {},
            promptOptions: {
              baseDelay: 1000,
              maxAttempts: 1,
            },
          }),
        ]
      : [];

  return createAuthClient({
    baseURL: getRuntimeAuthClientBaseURL(),
    plugins,
  });
}
