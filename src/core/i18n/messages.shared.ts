import { localeMessagesPaths, type Locale } from '@/config/locale';

import { routing } from './config';

export function normalizeLocale(
  input: string | null | undefined
): Locale | undefined {
  if (!input) return undefined;

  const normalized = input === 'zh-CN' ? 'zh' : input;

  return routing.locales.includes(normalized as Locale)
    ? (normalized as Locale)
    : undefined;
}

export function normalizeAppPathname(pathname: string): string {
  if (!pathname) return '/';

  const [pathWithoutHash] = pathname.split('#');
  const [pathWithoutQuery] = pathWithoutHash.split('?');
  const withLeadingSlash = pathWithoutQuery.startsWith('/')
    ? pathWithoutQuery
    : `/${pathWithoutQuery}`;
  const segments = withLeadingSlash.split('/').filter(Boolean);

  if (!segments.length) {
    return '/';
  }

  const [firstSegment, ...restSegments] = segments;
  const normalizedSegments = routing.locales.includes(firstSegment as Locale)
    ? restSegments
    : segments;
  const normalizedPath = `/${normalizedSegments.join('/')}`;

  if (normalizedPath === '/') {
    return normalizedPath;
  }

  return normalizedPath.replace(/\/+$/, '') || '/';
}

const sortedMessagePaths = [...localeMessagesPaths].sort(
  (left, right) => right.length - left.length
);

export function resolveMessagePath(namespace: string): string {
  const normalizedNamespace = namespace.replace(/\./g, '/');
  const matchedPath = sortedMessagePaths.find(
    (messagePath) =>
      normalizedNamespace === messagePath ||
      normalizedNamespace.startsWith(`${messagePath}/`)
  );

  if (matchedPath) {
    return matchedPath;
  }

  const [topLevelPath] = normalizedNamespace.split('/');
  if (localeMessagesPaths.includes(topLevelPath)) {
    return topLevelPath;
  }

  throw new Error(`[i18n] Unknown namespace "${namespace}"`);
}

function pushNamespace(target: string[], namespace: string) {
  if (!target.includes(namespace)) {
    target.push(namespace);
  }
}

function getAdminNamespaces(pathname: string) {
  const namespaces = ['admin.sidebar'];

  if (pathname.startsWith('/admin/ai-tasks')) pushNamespace(namespaces, 'admin.ai-tasks');
  if (pathname.startsWith('/admin/apikeys')) pushNamespace(namespaces, 'admin.apikeys');
  if (pathname.startsWith('/admin/categories')) pushNamespace(namespaces, 'admin.categories');
  if (pathname.startsWith('/admin/chats')) pushNamespace(namespaces, 'admin.chats');
  if (pathname.startsWith('/admin/credits')) pushNamespace(namespaces, 'admin.credits');
  if (pathname.startsWith('/admin/payments')) pushNamespace(namespaces, 'admin.payments');
  if (pathname.startsWith('/admin/permissions'))
    pushNamespace(namespaces, 'admin.permissions');
  if (pathname.startsWith('/admin/posts')) pushNamespace(namespaces, 'admin.posts');
  if (pathname.startsWith('/admin/roles')) pushNamespace(namespaces, 'admin.roles');
  if (pathname.startsWith('/admin/settings'))
    pushNamespace(namespaces, 'admin.settings');
  if (pathname.startsWith('/admin/subscriptions'))
    pushNamespace(namespaces, 'admin.subscriptions');
  if (pathname.startsWith('/admin/users')) pushNamespace(namespaces, 'admin.users');

  return namespaces;
}

function getSettingsNamespaces(pathname: string) {
  const namespaces = ['landing', 'settings.sidebar'];

  if (pathname.startsWith('/settings/apikeys')) {
    pushNamespace(namespaces, 'settings.apikeys');
  } else if (pathname.startsWith('/settings/billing')) {
    pushNamespace(namespaces, 'settings.billing');
  } else if (pathname.startsWith('/settings/credits')) {
    pushNamespace(namespaces, 'settings.credits');
  } else if (pathname.startsWith('/settings/payments')) {
    pushNamespace(namespaces, 'settings.payments');
  } else if (pathname.startsWith('/settings/profile')) {
    pushNamespace(namespaces, 'settings.profile');
  } else if (pathname.startsWith('/settings/security')) {
    pushNamespace(namespaces, 'settings.security');
  }

  return namespaces;
}

function getActivityNamespaces(pathname: string) {
  const namespaces = ['landing', 'activity.sidebar'];

  if (pathname.startsWith('/activity/ai-tasks')) {
    pushNamespace(namespaces, 'activity.ai-tasks');
  } else if (pathname.startsWith('/activity/chats')) {
    pushNamespace(namespaces, 'activity.chats');
  }

  return namespaces;
}

export function getRequestNamespaces(pathname: string): string[] {
  const normalizedPathname = normalizeAppPathname(pathname);

  if (normalizedPathname === '/api/payment/checkout') {
    return ['pricing'];
  }

  const namespaces: string[] = [];

  if (!normalizedPathname.startsWith('/api/')) {
    pushNamespace(namespaces, 'common.metadata');
  }

  if (normalizedPathname === '/') {
    pushNamespace(namespaces, 'landing');
    return namespaces;
  }

  if (
    normalizedPathname === '/sign-in' ||
    normalizedPathname === '/sign-up' ||
    normalizedPathname === '/forgot-password' ||
    normalizedPathname === '/reset-password'
  ) {
    pushNamespace(namespaces, 'common');
    return namespaces;
  }

  if (normalizedPathname.startsWith('/admin')) {
    return [...namespaces, ...getAdminNamespaces(normalizedPathname)];
  }

  if (normalizedPathname.startsWith('/chat')) {
    pushNamespace(namespaces, 'ai.chat');
    return namespaces;
  }

  if (normalizedPathname.startsWith('/settings')) {
    return [...namespaces, ...getSettingsNamespaces(normalizedPathname)];
  }

  if (normalizedPathname.startsWith('/activity')) {
    return [...namespaces, ...getActivityNamespaces(normalizedPathname)];
  }

  if (normalizedPathname === '/pricing') {
    pushNamespace(namespaces, 'landing');
    pushNamespace(namespaces, 'pricing');
    return namespaces;
  }

  if (normalizedPathname === '/blog' || normalizedPathname.startsWith('/blog/')) {
    pushNamespace(namespaces, 'landing');
    pushNamespace(namespaces, 'blog');
    return namespaces;
  }

  if (
    normalizedPathname === '/ai-image-generator' ||
    normalizedPathname === '/ai-music-generator'
  ) {
    pushNamespace(namespaces, 'landing');
  }

  if (normalizedPathname === '/ai-image-generator') {
    pushNamespace(namespaces, 'ai.image');
    return namespaces;
  }

  if (normalizedPathname === '/ai-music-generator') {
    pushNamespace(namespaces, 'ai.music');
    return namespaces;
  }

  if (normalizedPathname === '/ai-chatbot') {
    pushNamespace(namespaces, 'demo.ai-chatbot');
    return namespaces;
  }

  if (normalizedPathname === '/ai-video-generator') {
    pushNamespace(namespaces, 'demo.ai-video-generator');
    return namespaces;
  }

  if (normalizedPathname === '/ai-audio-generator') {
    pushNamespace(namespaces, 'demo.ai-audio-generator');
    return namespaces;
  }

  if (
    normalizedPathname === '/docs' ||
    normalizedPathname.startsWith('/docs/') ||
    normalizedPathname === '/no-permission'
  ) {
    return namespaces;
  }

  pushNamespace(namespaces, 'landing');

  return namespaces;
}
