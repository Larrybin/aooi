export const CLOUDFLARE_COMMAND_ENTRYPOINTS = Object.freeze([
  'scripts/check-cloudflare-config.mjs',
  'scripts/run-cf-state-deploy.mjs',
  'scripts/run-cf-app-deploy.mjs',
  'scripts/run-cf-multi-build-check.mjs',
  'scripts/check-cf-typegen.mjs',
  'scripts/lib/cloudflare-local-topology.mjs',
]);

export function findStaticWranglerPathBypass(content) {
  return /wrangler\.cloudflare\.toml|cloudflare\/wrangler\.[^"'\s]+\.toml/.test(
    content
  );
}
