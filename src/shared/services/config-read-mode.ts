import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

type ConfigMap = Record<string, string>;

export async function readServiceConfigsByMode(
  mode: ConfigConsistencyMode = 'cached',
  {
    getAllConfigsCachedImpl,
    getAllConfigsFreshImpl,
  }: {
    getAllConfigsCachedImpl: () => Promise<ConfigMap>;
    getAllConfigsFreshImpl: () => Promise<ConfigMap>;
  }
): Promise<ConfigMap> {
  return mode === 'fresh'
    ? await getAllConfigsFreshImpl()
    : await getAllConfigsCachedImpl();
}
