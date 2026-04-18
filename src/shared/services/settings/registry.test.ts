import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCT_MODULE_IDS } from '@/config/product-modules/types';

import {
  ALL_SETTINGS,
  KNOWN_SETTING_KEYS,
  PUBLIC_SETTING_NAMES,
  SETTING_GROUP_REGISTRY,
  deriveSettingsRegistry,
  getSettingGroupsFromRegistry,
} from './registry';
import { defineSettingsGroup } from './definitions/builder';
import { SETTING_TAB_NAMES } from './tab-names';

test('settings registry: name 唯一且 known keys 完整', () => {
  const names = ALL_SETTINGS.map((setting) => setting.name);

  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(KNOWN_SETTING_KEYS, names);
});

test('settings registry: 所有 moduleId 和 tab 都引用合法契约', () => {
  const validModuleIds = new Set<string>(PRODUCT_MODULE_IDS);
  const validTabs = new Set<string>(SETTING_TAB_NAMES);

  for (const setting of ALL_SETTINGS) {
    assert.equal(
      validModuleIds.has(setting.moduleId),
      true,
      `未知 moduleId: ${setting.moduleId}`
    );
    assert.equal(validTabs.has(setting.tab), true, `未知 tab: ${setting.tab}`);
  }
});

test('settings registry: public settings 精确来自 visibility=public', () => {
  const derived = ALL_SETTINGS.filter(
    (setting) => setting.visibility === 'public'
  ).map((setting) => setting.name);

  assert.deepEqual(PUBLIC_SETTING_NAMES, derived);
});

test('settings registry: public settings 契约不应误公开敏感或仅服务端消费的 key', () => {
  assert.equal(PUBLIC_SETTING_NAMES.includes('google_client_id'), true);
  assert.equal(PUBLIC_SETTING_NAMES.includes('github_client_id'), false);
  assert.equal(PUBLIC_SETTING_NAMES.includes('google_client_secret'), false);
  assert.equal(PUBLIC_SETTING_NAMES.includes('github_client_secret'), false);
  assert.equal(PUBLIC_SETTING_NAMES.includes('stripe_secret_key'), false);
});

test('settings registry: group 顺序与首次出现顺序一致', () => {
  const firstSeenGroupIds = [
    ...new Set(ALL_SETTINGS.map((setting) => setting.group.id)),
  ];

  assert.deepEqual(
    SETTING_GROUP_REGISTRY.map((group) => group.id),
    firstSeenGroupIds
  );
});

test('getSettingGroupsFromRegistry: 输出唯一 group 并保留顺序', () => {
  const groups = getSettingGroupsFromRegistry((key) => key);

  assert.deepEqual(
    groups.map((group) => group.name),
    SETTING_GROUP_REGISTRY.map((group) => group.id)
  );
  assert.deepEqual(
    groups.map((group) => group.title),
    SETTING_GROUP_REGISTRY.map((group) => group.titleKey)
  );
});

test('defineSettingsGroup: 展开后保留组级元数据和显式 visibility 覆盖', () => {
  const settings = defineSettingsGroup(
    {
      moduleId: 'auth',
      tab: 'auth',
      group: {
        id: 'google_auth',
        titleKey: 'groups.google_auth',
      },
      defaultVisibility: 'private',
    },
    [
      {
        name: 'google_auth_enabled',
        title: 'Auth Enabled',
        type: 'switch',
        visibility: 'public',
      },
      {
        name: 'google_client_secret',
        title: 'Google Client Secret',
        type: 'password',
      },
    ] as const
  );

  assert.deepEqual(
    settings.map((setting) => ({
      name: setting.name,
      moduleId: setting.moduleId,
      tab: setting.tab,
      groupId: setting.group.id,
      visibility: setting.visibility,
    })),
    [
      {
        name: 'google_auth_enabled',
        moduleId: 'auth',
        tab: 'auth',
        groupId: 'google_auth',
        visibility: 'public',
      },
      {
        name: 'google_client_secret',
        moduleId: 'auth',
        tab: 'auth',
        groupId: 'google_auth',
        visibility: 'private',
      },
    ]
  );
});

test('settings registry: DSL 重写后 key 集合保持不变', () => {
  assert.deepEqual([...KNOWN_SETTING_KEYS].sort(), [
    'ads_enabled',
    'ads_provider',
    'adsense_client_id',
    'adsense_slot_blog_post_footer',
    'adsense_slot_blog_post_inline',
    'adsense_slot_landing_inline_primary',
    'adsterra_ads_txt_entry',
    'adsterra_global_snippet',
    'adsterra_mode',
    'adsterra_zone_blog_post_footer_snippet',
    'adsterra_zone_blog_post_inline_snippet',
    'adsterra_zone_landing_inline_primary_snippet',
    'affonso_cookie_duration',
    'affonso_enabled',
    'affonso_id',
    'app_favicon',
    'app_logo',
    'app_name',
    'app_og_image',
    'app_url',
    'clarity_id',
    'creem_api_key',
    'creem_enabled',
    'creem_environment',
    'creem_product_ids',
    'creem_signing_secret',
    'crisp_enabled',
    'crisp_website_id',
    'default_payment_provider',
    'email_auth_enabled',
    'fal_api_key',
    'general_ai_enabled',
    'general_blog_enabled',
    'general_docs_enabled',
    'general_locale_switcher_enabled',
    'general_social_links',
    'general_social_links_enabled',
    'general_support_email',
    'github_auth_enabled',
    'github_client_id',
    'github_client_secret',
    'google_analytics_id',
    'google_auth_enabled',
    'google_client_id',
    'google_client_secret',
    'google_one_tap_enabled',
    'kie_api_key',
    'openpanel_client_id',
    'openrouter_api_key',
    'paypal_client_id',
    'paypal_client_secret',
    'paypal_enabled',
    'paypal_environment',
    'paypal_webhook_id',
    'plausible_domain',
    'plausible_src',
    'promotekit_enabled',
    'promotekit_id',
    'r2_access_key',
    'r2_bucket_name',
    'r2_domain',
    'r2_endpoint',
    'r2_secret_key',
    'replicate_api_token',
    'resend_api_key',
    'resend_sender_email',
    'select_payment_enabled',
    'stripe_enabled',
    'stripe_payment_methods',
    'stripe_publishable_key',
    'stripe_secret_key',
    'stripe_signing_secret',
    'tawk_enabled',
    'tawk_property_id',
    'tawk_widget_id',
    'vercel_analytics_enabled',
  ]);
});

test('deriveSettingsRegistry: group 元数据不一致时快速失败', () => {
  assert.throws(
    () =>
      deriveSettingsRegistry([
        {
          name: 'google_auth_enabled',
          title: 'Auth Enabled',
          type: 'switch',
          moduleId: 'auth',
          visibility: 'public',
          group: {
            id: 'google_auth',
            titleKey: 'groups.google_auth',
          },
          tab: 'auth',
        },
        {
          name: 'google_client_id',
          title: 'Google Client ID',
          type: 'text',
          moduleId: 'auth',
          visibility: 'public',
          group: {
            id: 'google_auth',
            titleKey: 'groups.google_auth_changed',
          },
          tab: 'auth',
        },
      ]),
    /Inconsistent group metadata detected/
  );
});
