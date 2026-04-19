import { jsonOk } from '@/shared/lib/api/response';
import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

type GetConfigsLogicDeps = {
  getPublicConfigsCached: () => Promise<Record<string, string>>;
  getPublicConfigsFresh: () => Promise<Record<string, string>>;
  resolveConfigConsistencyMode: (request: Request) => ConfigConsistencyMode;
};

export function buildGetConfigsLogic(deps: GetConfigsLogicDeps) {
  return async (request: Request) => {
    const configs =
      deps.resolveConfigConsistencyMode(request) === 'fresh'
        ? await deps.getPublicConfigsFresh()
        : await deps.getPublicConfigsCached();

    return jsonOk(configs);
  };
}
