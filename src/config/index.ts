import { readPublicEnvConfigs } from './public-env';

export type ConfigMap = Record<string, string>;

export const envConfigs = readPublicEnvConfigs();
