export function isCloudflareLocalWorkersDevRuntime(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.CF_LOCAL_SMOKE_WORKERS_DEV === 'true';
}
