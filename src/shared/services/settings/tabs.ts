import 'server-only';

import { getTranslations } from 'next-intl/server';

import type { Tab } from '@/shared/types/blocks/common';

export async function getSettingTabs(tab: string) {
  const t = await getTranslations('admin.settings');

  const tabs: Tab[] = [
    {
      name: 'general',
      title: t('edit.tabs.general'),
      url: '/changanpenpen/settings/general',
      is_active: tab === 'general',
    },
    {
      name: 'auth',
      title: t('edit.tabs.auth'),
      url: '/changanpenpen/settings/auth',
      is_active: tab === 'auth',
    },
    {
      name: 'payment',
      title: t('edit.tabs.payment'),
      url: '/changanpenpen/settings/payment',
      is_active: tab === 'payment',
    },
    {
      name: 'email',
      title: t('edit.tabs.email'),
      url: '/changanpenpen/settings/email',
      is_active: tab === 'email',
    },
    {
      name: 'storage',
      title: t('edit.tabs.storage'),
      url: '/changanpenpen/settings/storage',
      is_active: tab === 'storage',
    },

    {
      name: 'ai',
      title: t('edit.tabs.ai'),
      url: '/changanpenpen/settings/ai',
      is_active: tab === 'ai',
    },
    {
      name: 'analytics',
      title: t('edit.tabs.analytics'),
      url: '/changanpenpen/settings/analytics',
      is_active: tab === 'analytics',
    },
    {
      name: 'ads',
      title: t('edit.tabs.ads'),
      url: '/changanpenpen/settings/ads',
      is_active: tab === 'ads',
    },
    {
      name: 'affiliate',
      title: t('edit.tabs.affiliate'),
      url: '/changanpenpen/settings/affiliate',
      is_active: tab === 'affiliate',
    },
    {
      name: 'customer_service',
      title: t('edit.tabs.customer_service'),
      url: '/changanpenpen/settings/customer_service',
      is_active: tab === 'customer_service',
    },
  ];

  return tabs;
}
