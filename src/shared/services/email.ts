import 'server-only';

import { EmailManager } from '@/extensions/email';
import { ResendProvider } from '@/extensions/email/providers';
import type { Configs } from '@/shared/models/config';

import { buildServiceFromLatestConfigs } from './config_refresh_policy';

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
  return await buildServiceFromLatestConfigs(getEmailServiceWithConfigs);
}
