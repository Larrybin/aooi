import type { Button, NavItem } from '@/shared/types/blocks/common';

import { isConfigTrue } from '@/shared/lib/general-ui.client';
import {
  GENERAL_AI_ENABLED,
  isAiEnabled,
} from '@/domains/ai/domain/enablement';

export const GENERAL_BLOG_ENABLED = 'general_blog_enabled';
export const GENERAL_DOCS_ENABLED = 'general_docs_enabled';
export { GENERAL_AI_ENABLED, isAiEnabled };

export function isLandingBlogEnabled(
  publicConfigs: Record<string, string> | undefined
) {
  return isConfigTrue(publicConfigs ?? {}, GENERAL_BLOG_ENABLED);
}

export function isLandingDocsEnabled(
  publicConfigs: Record<string, string> | undefined
) {
  return isConfigTrue(publicConfigs ?? {}, GENERAL_DOCS_ENABLED);
}

export function isLandingAiEnabled(
  publicConfigs: Record<string, string> | undefined
) {
  return isAiEnabled(publicConfigs);
}

function shouldHideLandingUrl(
  url: string | undefined,
  configs: Record<string, string>
) {
  if (!url) return false;

  const normalizedUrl =
    url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;

  const isAiRoute =
    normalizedUrl === '/chat' ||
    normalizedUrl.startsWith('/chat/') ||
    normalizedUrl.startsWith('/ai-') ||
    normalizedUrl === '/activity' ||
    normalizedUrl.startsWith('/activity/') ||
    normalizedUrl === '/admin/ai-tasks' ||
    normalizedUrl.startsWith('/admin/ai-tasks/') ||
    normalizedUrl === '/admin/chats' ||
    normalizedUrl.startsWith('/admin/chats/');

  if (isAiRoute) {
    return !isAiEnabled(configs);
  }

  if (normalizedUrl === '/blog' || normalizedUrl.startsWith('/blog/')) {
    return !isLandingBlogEnabled(configs);
  }

  if (normalizedUrl === '/docs' || normalizedUrl.startsWith('/docs/')) {
    return !isLandingDocsEnabled(configs);
  }

  return false;
}

export function filterLandingNavItems(
  items: NavItem[] | undefined,
  publicConfigs: Record<string, string> | undefined
): NavItem[] {
  if (!items?.length) return [];

  const configs = publicConfigs ?? {};

  const filtered: NavItem[] = [];

  for (const item of items) {
    const children = item.children?.length
      ? filterLandingNavItems(item.children, publicConfigs)
      : [];

    const url = item.url ? item.url.trim() : '';
    const hideUrl = shouldHideLandingUrl(url || undefined, configs);

    const hasVisibleChildren = children.length > 0;
    const hasVisibleUrl = Boolean(url) && !hideUrl;

    if (!hasVisibleChildren && !hasVisibleUrl) {
      continue;
    }

    filtered.push({
      ...item,
      ...(hasVisibleChildren ? { children } : {}),
      url: hasVisibleUrl ? url : '',
    });
  }

  return filtered;
}

export function filterLandingButtons(
  buttons: Button[] | undefined,
  publicConfigs: Record<string, string> | undefined
): Button[] {
  if (!buttons?.length) return [];

  const configs = publicConfigs ?? {};

  return buttons.filter((button) => {
    const url = button.url ? button.url.trim() : '';
    return !shouldHideLandingUrl(url || undefined, configs);
  });
}
