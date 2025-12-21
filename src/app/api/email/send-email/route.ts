import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';
import { requirePermission, requireUser } from '@/shared/lib/api/guard';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { EmailSendBodySchema } from '@/shared/schemas/api/email/send-email';
import { getEmailService } from '@/shared/services/email';

const MAX_EMAIL_RECIPIENTS = 10;

export const POST = withApi(async (req: Request) => {
  const { log } = getRequestLogger(req);
  const user = await requireUser(req);
  await requirePermission(user.id, PERMISSIONS.SETTINGS_WRITE);
  const { emails, subject } = await parseJson(req, EmailSendBodySchema);

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
    result = await emailService.sendEmail({
      to,
      subject,
      ...buildVerificationCodeEmailPayload({ code: '123455' }),
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
