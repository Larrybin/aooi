import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { createApiContext } from '@/app/api/_lib/context';
import { readSelfUserDetailsUseCase } from '@/domains/account/application/use-cases';

import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

export const POST = withApi(async (req: Request) => {
  const user = await createApiContext(req).requireUser();
  const details = await readSelfUserDetailsUseCase(user.id, accountRuntimeDeps);

  return jsonOk(details, { headers: { 'Cache-Control': 'no-store' } });
});
