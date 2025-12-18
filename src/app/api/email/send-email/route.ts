import { VerificationCode } from '@/shared/blocks/email/verification-code';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { EmailSendBodySchema } from '@/shared/schemas/api/email/send-email';
import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { getEmailService } from '@/shared/services/email';

export const POST = withApi(async (req: Request) => {
  const { ctx, log } = getRequestLogger(req);
  const { emails, subject } = await parseJson(req, EmailSendBodySchema);

  const emailService = await getEmailService();
  const result = await emailService.sendEmail({
    to: emails,
    subject,
    react: VerificationCode({ code: '123455' }),
  });

  log.debug('send email result', {
    emailCount: Array.isArray(emails) ? emails.length : 1,
    success: result.success,
    messageId: result.messageId,
    provider: result.provider,
  });
  return jsonOk(result);
});
