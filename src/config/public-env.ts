import { getTrimmedEnvValue } from './env-contract';

export type PublicEnvConfigs = {
  theme: string;
  locale: string;
};

export const DEFAULT_PUBLIC_ENV_CONFIGS: Readonly<PublicEnvConfigs> =
  Object.freeze({
    theme: 'default',
    locale: 'en',
  });

type ResolvePublicEnvConfigsOptions = {
  nextPublicTheme?: string | null;
  nextPublicDefaultLocale?: string | null;
};

export function readPublicEnvConfigs(
  env: Partial<NodeJS.ProcessEnv> = process.env
): PublicEnvConfigs {
  return resolvePublicEnvConfigs({
    nextPublicTheme: getTrimmedEnvValue(env, 'NEXT_PUBLIC_THEME'),
    nextPublicDefaultLocale: getTrimmedEnvValue(
      env,
      'NEXT_PUBLIC_DEFAULT_LOCALE'
    ),
  });
}

export function resolvePublicEnvConfigs(
  options: ResolvePublicEnvConfigsOptions = {}
): PublicEnvConfigs {
  return {
    theme: options.nextPublicTheme?.trim() || DEFAULT_PUBLIC_ENV_CONFIGS.theme,
    locale:
      options.nextPublicDefaultLocale?.trim() ||
      DEFAULT_PUBLIC_ENV_CONFIGS.locale,
  };
}
