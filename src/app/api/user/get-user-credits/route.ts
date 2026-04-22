import { createApiContext } from '@/app/api/_lib/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { readAccountCreditsSummaryUseCase } from '@/domains/account/application/use-cases';
import { accountRuntimeDeps } from '@/app/account/runtime-deps';

export const POST = withApi(async (req: Request) => {
  const user = await createApiContext(req).requireUser();

  const credits = await readAccountCreditsSummaryUseCase(
    user.id,
    accountRuntimeDeps
  );

  return jsonOk(credits, { headers: { 'Cache-Control': 'no-store' } });
});
