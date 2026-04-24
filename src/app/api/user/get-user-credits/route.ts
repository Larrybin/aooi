import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { createApiContext } from '@/app/api/_lib/context';
import { readAccountCreditsSummaryUseCase } from '@/domains/account/application/use-cases';

import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

export const POST = withApi(async (req: Request) => {
  const user = await createApiContext(req).requireUser();

  const credits = await readAccountCreditsSummaryUseCase(
    user.id,
    accountRuntimeDeps
  );

  return jsonOk(credits, { headers: { 'Cache-Control': 'no-store' } });
});
