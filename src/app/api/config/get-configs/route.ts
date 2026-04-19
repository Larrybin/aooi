import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import {
  getPublicConfigsCached,
  getPublicConfigsFresh,
} from '@/shared/models/config';
import { buildGetConfigsLogic } from './route-logic';

type GetConfigsRouteDeps = {
  getPublicConfigsCached: typeof getPublicConfigsCached;
  getPublicConfigsFresh: typeof getPublicConfigsFresh;
  resolveConfigConsistencyMode: typeof resolveConfigConsistencyMode;
};

export function createGetConfigsHandler(
  overrides: Partial<GetConfigsRouteDeps> = {}
) {
  return withApi(
    buildGetConfigsLogic({
      getPublicConfigsCached,
      getPublicConfigsFresh,
      resolveConfigConsistencyMode,
      ...overrides,
    })
  );
}

export const GET = createGetConfigsHandler();
export const POST = createGetConfigsHandler();
