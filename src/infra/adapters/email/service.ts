import 'server-only';

import {
  readSettingsCached,
  type Configs,
} from '@/domains/settings/application/settings-store';

import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from '@/extensions/email';
import { ResendProvider } from '@/extensions/email/providers';
import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import {
  exactProviderNameKey,
  ProviderRegistry,
} from '@/shared/lib/providers/provider-registry';

export type EmailService = {
  sendEmail(email: EmailMessage): Promise<EmailSendResult>;
  sendEmailWithProvider(
    email: EmailMessage,
    providerName: string
  ): Promise<EmailSendResult>;
};

type CachedEmailService = {
  signature: string;
  servicePromise: Promise<EmailService>;
};

let cachedEmailService: CachedEmailService | null = null;

function buildConfigsSignature(configs: Configs): string {
  return JSON.stringify(
    Object.entries(configs)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, value ?? ''])
  );
}

/**
 * get email service with configs
 */
export function getEmailServiceWithConfigs(configs: Configs) {
  const registry = new ProviderRegistry<EmailProvider>({
    toNameKey: exactProviderNameKey,
    memoizeDefault: true,
  });

  if (configs.resend_api_key) {
    const sender = (configs.resend_sender_email ?? '').trim();
    if (!sender) {
      throw new Error(
        'resend_sender_email is required when resend_api_key is configured'
      );
    }

    registry.add(
      new ResendProvider({
        apiKey: configs.resend_api_key,
        defaultFrom: sender,
      })
    );
  }

  return {
    async sendEmail(email) {
      return await registry
        .getDefaultRequired(
          () => new ServiceUnavailableError('No email provider configured')
        )
        .sendEmail(email);
    },
    async sendEmailWithProvider(email, providerName) {
      return await registry
        .getRequired(
          providerName,
          (name) => new BadRequestError(`Email provider '${name}' not found`)
        )
        .sendEmail(email);
    },
  } satisfies EmailService;
}

/**
 * global email service
 */
export async function getEmailService(): Promise<EmailService> {
  const configs = await readSettingsCached();
  const signature = buildConfigsSignature(configs);

  if (cachedEmailService?.signature === signature) {
    return await cachedEmailService.servicePromise;
  }

  const servicePromise = Promise.resolve()
    .then(() => getEmailServiceWithConfigs(configs))
    .catch((error) => {
      // 避免缓存失败的 Promise
      if (cachedEmailService?.signature === signature) {
        cachedEmailService = null;
      }
      throw error;
    });

  cachedEmailService = { signature, servicePromise };
  return await servicePromise;
}
