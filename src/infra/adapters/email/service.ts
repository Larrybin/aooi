import 'server-only';

import {
  readEmailRuntimeBindings,
  readEmailRuntimeSettingsCached,
} from '@/domains/settings/application/settings-runtime.query';

import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from '@/extensions/email';
import { ResendProvider } from '@/extensions/email/providers';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import {
  exactProviderNameKey,
  ProviderRegistry,
} from '@/shared/lib/providers/provider-registry';

import { assertEmailCapabilityContract } from './contract';

export type EmailService = {
  sendEmail(email: EmailMessage): Promise<EmailSendResult>;
};

export function createEmailService(input: {
  settings: Awaited<ReturnType<typeof readEmailRuntimeSettingsCached>>;
  bindings: ReturnType<typeof readEmailRuntimeBindings>;
}) {
  const contract = assertEmailCapabilityContract(input);
  const registry = new ProviderRegistry<EmailProvider>({
    toNameKey: exactProviderNameKey,
    memoizeDefault: true,
  });

  registry.add(
    new ResendProvider({
      apiKey: contract.resendApiKey,
      defaultFrom: contract.resendSenderEmail,
    })
  );

  return {
    async sendEmail(email) {
      return await registry
        .getDefaultRequired(
          () => new ServiceUnavailableError('email service unavailable')
        )
        .sendEmail(email);
    },
  } satisfies EmailService;
}

export async function getEmailService(): Promise<EmailService> {
  const [settings, bindings] = await Promise.all([
    readEmailRuntimeSettingsCached(),
    Promise.resolve(readEmailRuntimeBindings()),
  ]);

  return createEmailService({
    settings,
    bindings,
  });
}
