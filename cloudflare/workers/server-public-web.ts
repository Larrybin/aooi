import { createServerWorker } from './create-server-worker';

export default createServerWorker(
  () =>
    import('../../.open-next/server-functions/default/handler.mjs') as Promise<{
      handler: (
        request: Request,
        env: unknown,
        ctx: ExecutionContext,
        signal?: AbortSignal
      ) => Promise<Response> | Response;
    }>
);
