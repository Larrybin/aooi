import type {
  EmailRuntimeBindings,
  EmailRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';

export type EmailCapabilityContractInput = {
  settings: EmailRuntimeSettings;
  bindings: EmailRuntimeBindings;
};

export function assertEmailCapabilityContract(
  input: EmailCapabilityContractInput
) {
  const resendSenderEmail = input.settings.resendSenderEmail.trim();
  const resendApiKey = input.bindings.resendApiKey.trim();

  if (!resendSenderEmail) {
    throw new Error('resend_sender_email is required');
  }

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is required');
  }

  return {
    provider: 'resend' as const,
    resendSenderEmail,
    resendApiKey,
  };
}
