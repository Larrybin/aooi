import { resolveCloudflareDeployProfile } from './site-deploy-profile.mjs';

export const CLOUDFLARE_PREVIEW_OPTIONAL_SECRET_NAMES = Object.freeze([
  'RESEND_API_KEY',
  'CREEM_API_KEY',
  'CREEM_SIGNING_SECRET',
]);

const previewOptionalSecretNames = new Set(
  CLOUDFLARE_PREVIEW_OPTIONAL_SECRET_NAMES
);

export function isPreviewOptionalSecretName(name) {
  return previewOptionalSecretNames.has(name);
}

export function shouldWarnOnlyForMissingPreviewSecret(name, processEnv) {
  return (
    resolveCloudflareDeployProfile(processEnv) === 'preview' &&
    isPreviewOptionalSecretName(name)
  );
}
