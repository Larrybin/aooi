export {
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_DURABLE_OBJECT_BINDINGS,
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  CLOUDFLARE_ROUTER_WORKER,
  CLOUDFLARE_ROUTER_WORKER_NAME,
  CLOUDFLARE_SERVER_WORKERS,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
  CLOUDFLARE_STATE_WORKER,
  CLOUDFLARE_STATE_WORKER_NAME,
  CLOUDFLARE_VERSION_ID_VARS,
  buildVersionOverridesHeader,
  getServerWorkerMetadata,
  type CloudflareServerWorkerTarget,
  type CloudflareSplitWorkerTarget,
} from './cloudflare-worker-topology';
export {
  getAllSplitWorkers,
  getSplitWorker,
  resolveWorkerTarget,
  stripLocalePrefix,
} from './cloudflare-worker-routing';

import topology from './cloudflare-worker-topology';
import {
  getAllSplitWorkers,
  getSplitWorker,
  resolveWorkerTarget,
  stripLocalePrefix,
} from './cloudflare-worker-routing';

const cloudflareWorkerSplits = {
  ...topology,
  stripLocalePrefix,
  resolveWorkerTarget,
  getSplitWorker,
  getAllSplitWorkers,
};

export default cloudflareWorkerSplits;
