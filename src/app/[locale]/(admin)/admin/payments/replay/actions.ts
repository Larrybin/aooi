'use server';

import {
  requireActionPermission,
  requireActionUser,
} from '@/app/access-control/action-guard';
import {
  executeAdminPaymentReplay,
  PaymentReplayActionSchema as ReplayActionSchema,
} from '@/domains/billing/application/admin-payment-replay';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { ActionError } from '@/shared/lib/action/errors';
import { parseFormData } from '@/shared/lib/action/form';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';

export async function executePaymentWebhookReplayAction(formData: FormData) {
  return withAction(async () => {
    const user = await requireActionUser();
    await requireActionPermission(user.id, PERMISSIONS.PAYMENTS_WRITE);

    const data = parseFormData(formData, ReplayActionSchema, {
      message: 'invalid replay payload',
    });

    const result = await executeAdminPaymentReplay({
      inboxIds: data.inboxIds,
      operationKind: data.operationKind,
      note: data.note,
      returnPath: data.returnPath,
      actorUserId: user.id,
    });
    if (result.status === 'not_found') {
      throw new ActionError('No webhook inbox records selected');
    }

    return actionOk(
      `replay finished: ${result.summary.processed} processed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`,
      result.redirectUrl
    );
  });
}
