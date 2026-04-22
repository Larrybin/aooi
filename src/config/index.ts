import {
  readBrowserOrigin,
  readPublicEnvConfigs,
} from './public-env';

export type ConfigMap = Record<string, string>;
export { resolveAppUrl } from './public-env';

export const envConfigs = readPublicEnvConfigs(undefined, readBrowserOrigin());
