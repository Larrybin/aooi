import { createApiContext } from '@/app/api/_lib/context';

import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import {
  buildPaymentCallbackGetHandler,
  buildPaymentCallbackPostAction,
} from './route-logic';

const getHandler = buildPaymentCallbackGetHandler({
  createApiContext,
});

export async function GET(req: Request) {
  return getHandler(req);
}

export const POST = withApi(
  buildPaymentCallbackPostAction({
    createApiContext,
    resolveMode: resolveConfigConsistencyMode,
  })
);
