import { locales } from '../../config/locale/index';

const localeSet: ReadonlySet<string> = new Set(locales);

export const CLOUDFLARE_ROUTER_WORKER_NAME = 'roller-rabbit' as const;

export const CLOUDFLARE_SERVER_WORKERS = {
  'public-web': 'roller-rabbit-public-web',
  auth: 'roller-rabbit-auth',
  payment: 'roller-rabbit-payment',
  member: 'roller-rabbit-member',
  chat: 'roller-rabbit-chat',
  admin: 'roller-rabbit-admin',
} as const;

export const CLOUDFLARE_SERVICE_BINDINGS = {
  'public-web': 'PUBLIC_WEB_WORKER',
  auth: 'AUTH_WORKER',
  payment: 'PAYMENT_WORKER',
  member: 'MEMBER_WORKER',
  chat: 'CHAT_WORKER',
  admin: 'ADMIN_WORKER',
} as const;

export const CLOUDFLARE_VERSION_ID_VARS = {
  'public-web': 'PUBLIC_WEB_WORKER_VERSION_ID',
  auth: 'AUTH_WORKER_VERSION_ID',
  payment: 'PAYMENT_WORKER_VERSION_ID',
  member: 'MEMBER_WORKER_VERSION_ID',
  chat: 'CHAT_WORKER_VERSION_ID',
  admin: 'ADMIN_WORKER_VERSION_ID',
} as const;

export const CLOUDFLARE_LOCAL_WORKER_URL_VARS = {
  'public-web': 'CF_LOCAL_PUBLIC_WEB_WORKER_URL',
  auth: 'CF_LOCAL_AUTH_WORKER_URL',
  payment: 'CF_LOCAL_PAYMENT_WORKER_URL',
  member: 'CF_LOCAL_MEMBER_WORKER_URL',
  chat: 'CF_LOCAL_CHAT_WORKER_URL',
  admin: 'CF_LOCAL_ADMIN_WORKER_URL',
} as const;

export const CLOUDFLARE_SPLIT_WORKER_TARGETS = [
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
] as const;

export const CLOUDFLARE_ALL_SERVER_WORKER_TARGETS = [
  'public-web',
  ...CLOUDFLARE_SPLIT_WORKER_TARGETS,
] as const;

export type CloudflareSplitWorkerTarget =
  (typeof CLOUDFLARE_SPLIT_WORKER_TARGETS)[number];

export type CloudflareServerWorkerTarget =
  (typeof CLOUDFLARE_ALL_SERVER_WORKER_TARGETS)[number];

type ServerWorkerMetadata = {
  readonly workerName: string;
  readonly serviceBinding: string;
  readonly versionIdVar: string;
  readonly bundleEntryRelativePath: string;
  readonly workerEntryRelativePath: string;
  readonly wranglerConfigRelativePath: string;
};

type WorkerSplitDefinition = ServerWorkerMetadata & {
  readonly routeTemplates: readonly string[];
  readonly patterns: readonly string[];
  readonly pathnamePrefixes?: readonly string[];
  readonly exactPathnames?: readonly string[];
};

const SERVER_WORKER_METADATA: Record<
  CloudflareServerWorkerTarget,
  ServerWorkerMetadata
> = {
  'public-web': {
    workerName: CLOUDFLARE_SERVER_WORKERS['public-web'],
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS['public-web'],
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS['public-web'],
    bundleEntryRelativePath: '.open-next/server-functions/default/index.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-public-web.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-public-web.toml',
  },
  auth: {
    workerName: CLOUDFLARE_SERVER_WORKERS.auth,
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.auth,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.auth,
    bundleEntryRelativePath: '.open-next/server-functions/auth/index.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-auth.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-auth.toml',
  },
  payment: {
    workerName: CLOUDFLARE_SERVER_WORKERS.payment,
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.payment,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.payment,
    bundleEntryRelativePath: '.open-next/server-functions/payment/index.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-payment.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-payment.toml',
  },
  member: {
    workerName: CLOUDFLARE_SERVER_WORKERS.member,
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.member,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.member,
    bundleEntryRelativePath: '.open-next/server-functions/member/index.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-member.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-member.toml',
  },
  chat: {
    workerName: CLOUDFLARE_SERVER_WORKERS.chat,
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.chat,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.chat,
    bundleEntryRelativePath: '.open-next/server-functions/chat/index.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-chat.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-chat.toml',
  },
  admin: {
    workerName: CLOUDFLARE_SERVER_WORKERS.admin,
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.admin,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.admin,
    bundleEntryRelativePath: '.open-next/server-functions/admin/index.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-admin.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-admin.toml',
  },
};

const SPLIT_WORKERS: Record<CloudflareSplitWorkerTarget, WorkerSplitDefinition> = {
  auth: {
    ...SERVER_WORKER_METADATA.auth,
    routeTemplates: ['app/api/auth/[...all]/route'],
    patterns: ['/api/auth', '/api/auth/*'],
    pathnamePrefixes: ['/api/auth'],
  },
  payment: {
    ...SERVER_WORKER_METADATA.payment,
    routeTemplates: [
      'app/api/payment/callback/route',
      'app/api/payment/checkout/route',
      'app/api/payment/notify/[provider]/route',
      'app/[locale]/(landing)/settings/billing/retrieve/page',
      'app/[locale]/(landing)/settings/invoices/retrieve/page',
    ],
    patterns: [
      '/api/payment',
      '/api/payment/*',
      '/settings/billing/retrieve',
      '/*/settings/billing/retrieve',
      '/settings/invoices/retrieve',
      '/*/settings/invoices/retrieve',
    ],
    pathnamePrefixes: ['/api/payment'],
    exactPathnames: [
      '/settings/billing/retrieve',
      '/settings/invoices/retrieve',
    ],
  },
  member: {
    ...SERVER_WORKER_METADATA.member,
    routeTemplates: [
      'app/[locale]/(landing)/activity/page',
      'app/[locale]/(landing)/activity/ai-tasks/page',
      'app/[locale]/(landing)/activity/ai-tasks/[id]/refresh/page',
      'app/[locale]/(landing)/activity/chats/page',
      'app/[locale]/(landing)/activity/feedbacks/page',
      'app/[locale]/(landing)/settings/page',
      'app/[locale]/(landing)/settings/apikeys/page',
      'app/[locale]/(landing)/settings/apikeys/[id]/edit/page',
      'app/[locale]/(landing)/settings/apikeys/[id]/delete/page',
      'app/[locale]/(landing)/settings/apikeys/create/page',
      'app/[locale]/(landing)/settings/payments/page',
      'app/[locale]/(landing)/settings/security/page',
      'app/[locale]/(landing)/settings/profile/page',
      'app/[locale]/(landing)/settings/credits/page',
      'app/[locale]/(landing)/settings/billing/page',
      'app/[locale]/(landing)/settings/billing/cancel/page',
      'app/api/user/self-details/route',
      'app/api/user/get-user-credits/route',
    ],
    patterns: [
      '/activity',
      '/activity/*',
      '/*/activity',
      '/*/activity/*',
      '/settings',
      '/settings/*',
      '/*/settings',
      '/*/settings/*',
      '/api/user/self-details',
      '/api/user/get-user-credits',
    ],
    pathnamePrefixes: ['/activity', '/settings'],
    exactPathnames: ['/api/user/self-details', '/api/user/get-user-credits'],
  },
  chat: {
    ...SERVER_WORKER_METADATA.chat,
    routeTemplates: [
      'app/[locale]/(chat)/chat/page',
      'app/[locale]/(chat)/chat/history/page',
      'app/[locale]/(chat)/chat/[id]/page',
      'app/api/chat/route',
      'app/api/chat/info/route',
      'app/api/chat/list/route',
      'app/api/chat/messages/route',
      'app/api/chat/new/route',
    ],
    patterns: [
      '/chat',
      '/chat/*',
      '/*/chat',
      '/*/chat/*',
      '/api/chat',
      '/api/chat/*',
    ],
    pathnamePrefixes: ['/chat', '/api/chat'],
  },
  admin: {
    ...SERVER_WORKER_METADATA.admin,
    routeTemplates: [
      'app/[locale]/(admin)/admin/page',
      'app/[locale]/(admin)/admin/credits/page',
      'app/[locale]/(admin)/admin/posts/page',
      'app/[locale]/(admin)/admin/permissions/page',
      'app/[locale]/(admin)/admin/chats/page',
      'app/[locale]/(admin)/admin/categories/page',
      'app/[locale]/(admin)/admin/posts/[id]/edit/page',
      'app/[locale]/(admin)/admin/posts/add/page',
      'app/[locale]/(admin)/admin/roles/page',
      'app/[locale]/(admin)/admin/apikeys/page',
      'app/[locale]/(admin)/admin/users/page',
      'app/[locale]/(admin)/admin/payments/page',
      'app/[locale]/(admin)/admin/categories/add/page',
      'app/[locale]/(admin)/admin/subscriptions/page',
      'app/[locale]/(admin)/admin/ai-tasks/page',
      'app/[locale]/admin/no-permission/page',
      'app/[locale]/(admin)/admin/roles/[id]/delete/page',
      'app/[locale]/(admin)/admin/settings/[tab]/page',
      'app/[locale]/(admin)/admin/roles/[id]/restore/page',
      'app/[locale]/(admin)/admin/roles/[id]/edit-permissions/page',
      'app/[locale]/(admin)/admin/categories/[id]/edit/page',
      'app/[locale]/(admin)/admin/roles/[id]/edit/page',
      'app/[locale]/(admin)/admin/users/[id]/edit-roles/page',
      'app/[locale]/(admin)/admin/users/[id]/edit/page',
    ],
    patterns: ['/admin', '/admin/*', '/*/admin', '/*/admin/*'],
    pathnamePrefixes: ['/admin'],
  },
};

export function stripLocalePrefix(pathname: string) {
  const normalized = normalizePathname(pathname);
  const [, firstSegment = ''] = normalized.split('/');
  if (!localeSet.has(firstSegment)) {
    return normalized;
  }

  const withoutLocale = normalized.slice(firstSegment.length + 1);
  return normalizePathname(withoutLocale || '/');
}

export function resolveWorkerTarget(
  pathname: string
): CloudflareServerWorkerTarget {
  const strippedPathname = stripLocalePrefix(pathname);

  for (const target of CLOUDFLARE_SPLIT_WORKER_TARGETS) {
    if (matchesSplitPathname(SPLIT_WORKERS[target], strippedPathname)) {
      return target;
    }
  }

  return 'public-web';
}

export function getSplitWorker(target: CloudflareSplitWorkerTarget) {
  return SPLIT_WORKERS[target];
}

export function getAllSplitWorkers() {
  return SPLIT_WORKERS;
}

export function getServerWorkerMetadata(target: CloudflareServerWorkerTarget) {
  return SERVER_WORKER_METADATA[target];
}

export function buildVersionOverridesHeader(
  env: Record<string, string | undefined>
) {
  const entries = CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => {
    const metadata = SERVER_WORKER_METADATA[target];
    const versionId = env[metadata.versionIdVar]?.trim();

    if (!versionId) {
      return null;
    }

    return `${metadata.workerName}="${versionId}"`;
  }).filter((value): value is string => value !== null);

  return entries.length === 0 ? null : entries.join(', ');
}

function matchesSplitPathname(
  split: Pick<WorkerSplitDefinition, 'pathnamePrefixes' | 'exactPathnames'>,
  pathname: string
) {
  const exactPathnames = split.exactPathnames || [];
  if (exactPathnames.includes(pathname)) {
    return true;
  }

  const pathnamePrefixes = split.pathnamePrefixes || [];
  return pathnamePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function normalizePathname(pathname: string) {
  if (!pathname) {
    return '/';
  }

  const url = new URL(pathname, 'https://router.internal');
  const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

const cloudflareWorkerSplits = {
  CLOUDFLARE_ROUTER_WORKER_NAME,
  CLOUDFLARE_SERVER_WORKERS,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_VERSION_ID_VARS,
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  stripLocalePrefix,
  resolveWorkerTarget,
  getSplitWorker,
  getAllSplitWorkers,
  getServerWorkerMetadata,
  buildVersionOverridesHeader,
};

export default cloudflareWorkerSplits;
