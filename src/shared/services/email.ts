import 'server-only';

import { EmailManager } from '@/extensions/email';
import { ResendProvider } from '@/extensions/email/providers';
import { getAllConfigs, type Configs } from '@/shared/models/config';

type CachedEmailService = {
  signature: string;
  servicePromise: Promise<EmailManager>;
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
  const emailManager = new EmailManager();

  if (configs.resend_api_key) {
    emailManager.addProvider(
      new ResendProvider({
        apiKey: configs.resend_api_key,
        defaultFrom: configs.resend_sender_email,
      })
    );
  }

  return emailManager;
}

/**
 * global email service
 */
export async function getEmailService(): Promise<EmailManager> {
  const configs = await getAllConfigs();
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
