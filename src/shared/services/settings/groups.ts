import 'server-only';

import { getTranslations } from 'next-intl/server';

import type { SettingGroup } from './types';

export async function getSettingGroups() {
  const t = await getTranslations('admin.settings');
  const settingGroups: SettingGroup[] = [
    {
      name: 'general_ui',
      title: t('groups.general_ui'),
      description: 'custom your general ui settings',
      tab: 'general',
    },
    {
      name: 'general_brand',
      title: t('groups.general_brand'),
      description: 'custom your brand settings',
      tab: 'general',
    },
    {
      name: 'email_auth',
      title: t('groups.email_auth'),
      description: 'custom your email auth settings',
      tab: 'auth',
    },
    {
      name: 'google_auth',
      title: t('groups.google_auth'),
      description: 'custom your google auth settings',
      tab: 'auth',
    },
    {
      name: 'github_auth',
      title: t('groups.github_auth'),
      description: 'custom your github auth settings',
      tab: 'auth',
    },
    {
      name: 'basic_payment',
      title: t('groups.basic_payment'),
      description: 'custom your basic payment settings',
      tab: 'payment',
    },
    {
      name: 'stripe',
      title: t('groups.stripe'),
      description:
        'custom your <a href="https://stripe.com" class="text-primary" target="_blank">Stripe</a> settings',
      tab: 'payment',
    },
    {
      name: 'creem',
      title: t('groups.creem'),
      description:
        'custom your <a href="https://www.creem.io" class="text-primary" target="_blank">Creem</a> settings',
      tab: 'payment',
    },
    {
      name: 'paypal',
      title: t('groups.paypal'),
      description: 'custom your paypal settings',
      tab: 'payment',
    },
    {
      name: 'google_analytics',
      title: t('groups.google_analytics'),
      description:
        'custom your <a href="https://analytics.google.com/" class="text-primary" target="_blank">Google Analytics</a> settings',
      tab: 'analytics',
    },
    {
      name: 'clarity',
      title: t('groups.clarity'),
      description:
        'custom your <a href="https://clarity.microsoft.com/" class="text-primary" target="_blank">Clarity</a> settings',
      tab: 'analytics',
    },
    {
      name: 'plausible',
      title: t('groups.plausible'),
      description:
        'custom your <a href="https://plausible.io/" class="text-primary" target="_blank">Plausible</a> settings',
      tab: 'analytics',
    },
    {
      name: 'openpanel',
      title: t('groups.openpanel'),
      description:
        'custom your <a href="https://openpanel.dev/" class="text-primary" target="_blank">OpenPanel</a> settings',
      tab: 'analytics',
    },
    {
      name: 'vercel_analytics',
      title: t('groups.vercel_analytics'),
      description:
        'custom your <a href="https://vercel.com/docs/analytics/" class="text-primary" target="_blank">Vercel Analytics</a> settings',
      tab: 'analytics',
    },
    {
      name: 'resend',
      title: t('groups.resend'),
      description: 'custom your resend settings',
      tab: 'email',
    },
    {
      name: 'r2',
      title: t('groups.r2'),
      description: 'custom your cloudflare r2 settings',
      tab: 'storage',
    },
    {
      name: 'openrouter',
      title: t('groups.openrouter'),
      description: `Custom <a href="https://openrouter.ai" class="text-primary" target="_blank">OpenRouter</a> settings`,
      tab: 'ai',
    },
    {
      name: 'replicate',
      title: t('groups.replicate'),
      description: `Custom <a href="https://replicate.com" class="text-primary" target="_blank">Replicate</a> settings`,
      tab: 'ai',
    },
    {
      name: 'fal',
      title: 'Fal',
      description: `Custom <a href="https://fal.ai" class="text-primary" target="_blank">Fal</a> settings`,
      tab: 'ai',
    },
    {
      name: 'kie',
      title: 'Kie',
      description: `Custom <a href="https://kie.ai" class="text-primary" target="_blank">Kie</a> settings`,
      tab: 'ai',
    },
    {
      name: 'adsense',
      title: t('groups.adsense'),
      description: 'custom your adsense settings',
      tab: 'ads',
    },
    {
      name: 'affonso',
      title: t('groups.affonso'),
      description:
        'custom your <a href="https://affonso.io" class="text-primary" target="_blank">Affonso</a> settings',
      tab: 'affiliate',
    },
    {
      name: 'promotekit',
      title: t('groups.promotekit'),
      description:
        'custom your <a href="https://www.promotekit.com" class="text-primary" target="_blank">PromoteKit</a> settings',
      tab: 'affiliate',
    },
    {
      name: 'crisp',
      title: t('groups.crisp'),
      description:
        'custom your <a href="https://crisp.chat" class="text-primary" target="_blank">Crisp</a> settings',
      tab: 'customer_service',
    },
    {
      name: 'tawk',
      title: t('groups.tawk'),
      description:
        'custom your <a href="https://www.tawk.to" class="text-primary" target="_blank">Tawk</a> settings',
      tab: 'customer_service',
    },
  ];
  return settingGroups;
}
