import type { SettingTabName } from '@/shared/services/settings/tab-names';

import type {
  ModuleGuideSlug,
  ProductModule,
  ProductModuleId,
  ProductModuleTier,
  ProductModuleVerification,
} from './types';

export type {
  ModuleGuideSlug,
  ProductModule,
  ProductModuleId,
  ProductModuleTier,
  ProductModuleVerification,
} from './types';
export {
  MODULE_GUIDE_SLUGS,
  PRODUCT_MODULE_IDS,
  PRODUCT_MODULE_TIERS,
  PRODUCT_MODULE_VERIFICATIONS,
} from './types';

const TIER_PRIORITY: Record<ProductModuleTier, number> = {
  mainline: 0,
  optional: 1,
  experimental: 2,
};

const RELATIONSHIP_PRIORITY = {
  owned: 0,
  supporting: 1,
} as const;

export type ProductModuleTabRelationship = keyof typeof RELATIONSHIP_PRIORITY;

export interface ProductModuleTabItem {
  moduleId: ProductModuleId;
  title: string;
  relationship: ProductModuleTabRelationship;
  tier: ProductModuleTier;
  verification: ProductModuleVerification;
  guideHref: string;
}

export const PRODUCT_MODULE_GUIDE_REPO_BASE_URL =
  'https://github.com/Larrybin/aooi/blob/main/docs/guides/';

export const PRODUCT_MODULES: ProductModule[] = [
  {
    id: 'core_shell',
    title: 'Core Shell',
    tier: 'mainline',
    verification: 'verified',
    ownedTabs: ['general'],
    supportingTabs: [],
    settingKeys: [
      'app_name',
      'app_url',
      'app_logo',
      'app_favicon',
      'app_og_image',
      'general_support_email',
      'general_locale_switcher_enabled',
      'general_social_links_enabled',
      'general_social_links',
    ],
    docSlug: 'module-contract#core-shell',
    entryRoutes: ['/', '/pricing', '/sign-in', '/sign-up'],
    externalServices: [],
  },
  {
    id: 'auth',
    title: 'Auth',
    tier: 'mainline',
    verification: 'partial',
    ownedTabs: ['auth'],
    supportingTabs: ['email'],
    settingKeys: [
      'email_auth_enabled',
      'google_auth_enabled',
      'google_one_tap_enabled',
      'google_client_id',
      'google_client_secret',
      'github_auth_enabled',
      'github_client_id',
      'github_client_secret',
      'resend_api_key',
      'resend_sender_email',
    ],
    docSlug: 'modules/auth',
    entryRoutes: ['/sign-in', '/sign-up', '/forgot-password'],
    externalServices: ['Google OAuth', 'GitHub OAuth', 'Resend'],
  },
  {
    id: 'billing',
    title: 'Billing',
    tier: 'mainline',
    verification: 'partial',
    ownedTabs: ['payment'],
    supportingTabs: [],
    settingKeys: [
      'select_payment_enabled',
      'default_payment_provider',
      'stripe_enabled',
      'stripe_publishable_key',
      'stripe_secret_key',
      'stripe_signing_secret',
      'stripe_payment_methods',
      'creem_enabled',
      'creem_environment',
      'creem_api_key',
      'creem_signing_secret',
      'creem_product_ids',
      'paypal_enabled',
      'paypal_environment',
      'paypal_client_id',
      'paypal_client_secret',
      'paypal_webhook_id',
    ],
    docSlug: 'modules/billing',
    entryRoutes: ['/pricing', '/api/payment/checkout', '/api/payment/notify'],
    externalServices: ['Stripe', 'Creem', 'PayPal'],
  },
  {
    id: 'admin_settings',
    title: 'Admin Settings',
    tier: 'mainline',
    verification: 'verified',
    ownedTabs: [],
    supportingTabs: [],
    settingKeys: [],
    docSlug: 'module-contract#admin-settings',
    entryRoutes: ['/admin/settings/general'],
    externalServices: [],
  },
  {
    id: 'deploy_contract',
    title: 'Deploy Contract',
    tier: 'mainline',
    verification: 'partial',
    ownedTabs: [],
    supportingTabs: [],
    settingKeys: [],
    docSlug: 'module-contract#deploy-contract',
    entryRoutes: ['/api/config/get-configs'],
    externalServices: ['Vercel', 'Cloudflare'],
  },
  {
    id: 'docs',
    title: 'Docs',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: ['content'],
    supportingTabs: [],
    settingKeys: ['general_docs_enabled'],
    docSlug: 'modules/docs-blog',
    entryRoutes: ['/docs'],
    externalServices: [],
  },
  {
    id: 'blog',
    title: 'Blog',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: ['content'],
    supportingTabs: [],
    settingKeys: ['general_blog_enabled'],
    docSlug: 'modules/docs-blog',
    entryRoutes: ['/blog'],
    externalServices: [],
  },
  {
    id: 'ai',
    title: 'AI',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: ['ai'],
    supportingTabs: [],
    settingKeys: [
      'general_ai_enabled',
      'openrouter_api_key',
      'replicate_api_token',
      'fal_api_key',
      'kie_api_key',
    ],
    docSlug: 'modules/ai',
    entryRoutes: ['/ai-chatbot', '/api/ai/notify/test-provider'],
    externalServices: ['OpenRouter', 'Replicate', 'Fal', 'Kie'],
  },
  {
    id: 'storage',
    title: 'Storage',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: ['storage'],
    supportingTabs: [],
    settingKeys: [
      'r2_access_key',
      'r2_secret_key',
      'r2_bucket_name',
      'r2_endpoint',
      'r2_domain',
    ],
    docSlug: 'modules/storage',
    entryRoutes: ['/api/storage/upload-image'],
    externalServices: ['Cloudflare R2'],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['analytics'],
    supportingTabs: [],
    settingKeys: [
      'google_analytics_id',
      'clarity_id',
      'plausible_domain',
      'plausible_src',
      'openpanel_client_id',
      'vercel_analytics_enabled',
    ],
    docSlug: 'modules/growth-support',
    entryRoutes: [],
    externalServices: [
      'Google Analytics',
      'Clarity',
      'Plausible',
      'OpenPanel',
      'Vercel Analytics',
    ],
  },
  {
    id: 'affiliate',
    title: 'Affiliate',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['affiliate'],
    supportingTabs: [],
    settingKeys: ['affonso_enabled', 'promotekit_enabled'],
    docSlug: 'modules/growth-support',
    entryRoutes: [],
    externalServices: ['Affonso', 'PromoteKit'],
  },
  {
    id: 'customer_service',
    title: 'Customer Service',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['customer_service'],
    supportingTabs: ['email'],
    settingKeys: ['crisp_enabled', 'tawk_enabled'],
    docSlug: 'modules/growth-support',
    entryRoutes: [],
    externalServices: ['Crisp', 'Tawk', 'Resend'],
  },
  {
    id: 'ads',
    title: 'Ads',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['ads'],
    supportingTabs: [],
    settingKeys: [
      'ads_enabled',
      'ads_provider',
      'adsense_client_id',
      'adsense_slot_landing_inline_primary',
      'adsense_slot_blog_post_inline',
      'adsense_slot_blog_post_footer',
      'adsterra_mode',
      'adsterra_global_script_src',
      'adsterra_zone_landing_inline_primary_script_src',
      'adsterra_zone_blog_post_inline_script_src',
      'adsterra_zone_blog_post_footer_script_src',
      'adsterra_ads_txt_entry',
    ],
    docSlug: 'modules/growth-support',
    entryRoutes: ['/ads.txt'],
    externalServices: ['Google AdSense', 'Adsterra'],
  },
];

export function getProductModulesByTier(tier: ProductModuleTier) {
  return PRODUCT_MODULES.filter((module) => module.tier === tier);
}

export function getSupportingProductModulesByTab(tab: SettingTabName) {
  return PRODUCT_MODULES.filter((module) =>
    module.supportingTabs.includes(tab)
  );
}

const PRODUCT_MODULE_ORDER = new Map(
  PRODUCT_MODULES.map((module, index) => [module.id, index] as const)
);

function createProductModuleTabItem(
  module: ProductModule,
  relationship: ProductModuleTabRelationship
): ProductModuleTabItem {
  return {
    moduleId: module.id,
    title: module.title,
    relationship,
    tier: module.tier,
    verification: module.verification,
    guideHref: getProductModuleGuideHref(module),
  };
}

function compareTabItemPriority(
  a: ProductModuleTabItem,
  b: ProductModuleTabItem
) {
  return (
    RELATIONSHIP_PRIORITY[a.relationship] -
      RELATIONSHIP_PRIORITY[b.relationship] ||
    TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier] ||
    (PRODUCT_MODULE_ORDER.get(a.moduleId) ?? Number.MAX_SAFE_INTEGER) -
      (PRODUCT_MODULE_ORDER.get(b.moduleId) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function getProductModuleItemsByTab(tab: SettingTabName) {
  return PRODUCT_MODULES.flatMap((module) =>
    (
      [
        { relationship: 'owned', tabs: module.ownedTabs },
        { relationship: 'supporting', tabs: module.supportingTabs },
      ] as const
    )
      .filter(({ tabs }) => tabs.includes(tab))
      .map(({ relationship }) =>
        createProductModuleTabItem(module, relationship)
      )
  ).sort(compareTabItemPriority);
}

export function getProductModuleGuideHref(
  moduleOrSlug: ProductModule | ModuleGuideSlug
) {
  const docSlug =
    typeof moduleOrSlug === 'string' ? moduleOrSlug : moduleOrSlug.docSlug;

  if (docSlug.startsWith('module-contract#')) {
    const anchor = docSlug.split('#')[1];
    return `${PRODUCT_MODULE_GUIDE_REPO_BASE_URL}module-contract.md#${anchor}`;
  }

  return `${PRODUCT_MODULE_GUIDE_REPO_BASE_URL}${docSlug}.md`;
}
