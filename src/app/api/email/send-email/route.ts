import { randomInt } from 'crypto';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { createApiContext } from '@/shared/lib/api/context';
import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { EmailSendBodySchema } from '@/shared/schemas/api/email/send-email';
import { getEmailService } from '@/shared/services/email';

const MAX_EMAIL_RECIPIENTS = 10;

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const user = await api.requireUser();
  await api.requirePermission(user.id, PERMISSIONS.SETTINGS_WRITE);
  const { emails, subject } = await api.parseJson(EmailSendBodySchema);

  const to = Array.isArray(emails) ? emails : [emails];
  if (to.length > MAX_EMAIL_RECIPIENTS) {
    throw new BadRequestError(
      `too many recipients (max ${MAX_EMAIL_RECIPIENTS})`
    );
  }

  let emailService;
  try {
    emailService = await getEmailService();
  } catch (error: unknown) {
    log.error('[API] Email service init failed', { error });
    throw new UpstreamError(503, 'email service unavailable');
  }

  let result;
  try {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    result = await emailService.sendEmail({
      to,
      subject,
      ...buildVerificationCodeEmailPayload({ code }),
    });
  } catch (error: unknown) {
    log.error('[API] sendEmail threw', { error });
    throw new UpstreamError(503, 'email service unavailable');
  }

  if (!result.success) {
    log.error('[API] sendEmail failed', {
      provider: result.provider,
      error: result.error,
    });
    throw new UpstreamError(502, 'send email failed');
  }

  log.debug('send email result', {
    emailCount: Array.isArray(emails) ? emails.length : 1,
    success: result.success,
    messageId: result.messageId,
    provider: result.provider,
  });
  return jsonOk(result);
});
