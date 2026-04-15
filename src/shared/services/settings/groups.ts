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
      name: 'content_modules',
      title: t('groups.content_modules'),
      description: 'custom your docs and blog module settings',
      tab: 'content',
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
        'custom your <a href="https://stripe.com" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Stripe</a> settings',
      tab: 'payment',
    },
    {
      name: 'creem',
      title: t('groups.creem'),
      description:
        'custom your <a href="https://www.creem.io" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Creem</a> settings',
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
        'custom your <a href="https://analytics.google.com/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Google Analytics</a> settings',
      tab: 'analytics',
    },
    {
      name: 'clarity',
      title: t('groups.clarity'),
      description:
        'custom your <a href="https://clarity.microsoft.com/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Clarity</a> settings',
      tab: 'analytics',
    },
    {
      name: 'plausible',
      title: t('groups.plausible'),
      description:
        'custom your <a href="https://plausible.io/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Plausible</a> settings',
      tab: 'analytics',
    },
    {
      name: 'openpanel',
      title: t('groups.openpanel'),
      description:
        'custom your <a href="https://openpanel.dev/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">OpenPanel</a> settings',
      tab: 'analytics',
    },
    {
      name: 'vercel_analytics',
      title: t('groups.vercel_analytics'),
      description:
        'custom your <a href="https://vercel.com/docs/analytics/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Vercel Analytics</a> settings',
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
      name: 'ai_module',
      title: t('groups.ai_module'),
      description: 'custom your ai module availability',
      tab: 'ai',
    },
    {
      name: 'openrouter',
      title: t('groups.openrouter'),
      description: `Custom <a href="https://openrouter.ai" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">OpenRouter</a> settings`,
      tab: 'ai',
    },
    {
      name: 'replicate',
      title: t('groups.replicate'),
      description: `Custom <a href="https://replicate.com" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Replicate</a> settings`,
      tab: 'ai',
    },
    {
      name: 'fal',
      title: 'Fal',
      description: `Custom <a href="https://fal.ai" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Fal</a> settings`,
      tab: 'ai',
    },
    {
      name: 'kie',
      title: 'Kie',
      description: `Custom <a href="https://kie.ai" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Kie</a> settings`,
      tab: 'ai',
    },
    {
      name: 'ads_basic',
      title: t('groups.ads_basic'),
      description: 'choose the active ads provider and enable the ads runtime',
      tab: 'ads',
    },
    {
      name: 'adsense',
      title: t('groups.adsense'),
      description:
        'custom your <a href="https://adsense.google.com/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">AdSense</a> runtime and zone settings',
      tab: 'ads',
    },
    {
      name: 'adsterra',
      title: t('groups.adsterra'),
      description:
        'custom your <a href="https://adsterra.com/blog/set-up-publishers-dashboard/#add-your-first-website-and-start-monetizing" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Adsterra</a> snippet and zone settings',
      tab: 'ads',
    },
    {
      name: 'affonso',
      title: t('groups.affonso'),
      description:
        'custom your <a href="https://affonso.io" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Affonso</a> settings',
      tab: 'affiliate',
    },
    {
      name: 'promotekit',
      title: t('groups.promotekit'),
      description:
        'custom your <a href="https://www.promotekit.com" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">PromoteKit</a> settings',
      tab: 'affiliate',
    },
    {
      name: 'crisp',
      title: t('groups.crisp'),
      description:
        'custom your <a href="https://crisp.chat" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Crisp</a> settings',
      tab: 'customer_service',
    },
    {
      name: 'tawk',
      title: t('groups.tawk'),
      description:
        'custom your <a href="https://www.tawk.to" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Tawk</a> settings',
      tab: 'customer_service',
    },
  ];
  return settingGroups;
}
