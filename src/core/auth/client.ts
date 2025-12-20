import {
  oneTapClient,
  type GoogleOneTapOptions,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { envConfigs } from '@/config';

type OneTapPlugin = NonNullable<
  Exclude<Parameters<typeof createAuthClient>[0], undefined>['plugins']
>[number];

const makeOneTapPlugin = (options: GoogleOneTapOptions): OneTapPlugin =>
  oneTapClient(options) as OneTapPlugin;

// auth client for client-side use
export const authClient = createAuthClient({
  baseURL: envConfigs.app_url,
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
  const plugins =
    configs.google_client_id && configs.google_one_tap_enabled === 'true'
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
    baseURL: envConfigs.app_url,
    plugins,
  });

  return authClient;
}
