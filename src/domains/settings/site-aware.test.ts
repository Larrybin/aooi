import assert from 'node:assert/strict';
import test from 'node:test';

import { mapSettingsToForms } from './settings-form-mapper';

test('site-aware settings: payment=none 时 payment tab 不存在', async () => {
  const originalSite = process.env.SITE;
  process.env.SITE = 'mamamiya';

  try {
    const mod = await import('./site-aware');
    const tabs = await mod.getAvailableSettingTabs();
    const settings = await mod.getSettings();

    assert.equal(tabs.includes('payment'), false);
    assert.equal(settings.some((setting) => setting.tab === 'payment'), false);
  } finally {
    if (originalSite === undefined) {
      delete process.env.SITE;
    } else {
      process.env.SITE = originalSite;
    }
  }
});

test('site-aware settings: 测试站点 payment!=none 时只暴露当前 provider 组', async () => {
  const originalSite = process.env.SITE;
  process.env.SITE = 'dev-local';

  const originalGeneratedSite = process.env.NODE_ENV;

  try {
    const siteModulePath = '@/site';
    const settingsModulePath = './site-aware';
    const registryModulePath = './registry';
    const [siteModule, settingsModule, registryModule] = await Promise.all([
      import(siteModulePath),
      import(settingsModulePath),
      import(registryModulePath),
    ]);

    const originalCapability = siteModule.site.capabilities.payment;
    siteModule.site.capabilities.payment = 'stripe';

    try {
      const tabs = await settingsModule.getAvailableSettingTabs();
      const settings = await settingsModule.getSettings();
      const groups = registryModule.getSettingGroupsFromDefinitions(
        settings,
        (key: string) => key
      );
      const forms = mapSettingsToForms({
        tab: 'payment',
        groups,
        settings,
        configs: {},
        submitLabel: 'Save',
        onSubmit: async () => ({
          status: 'success',
          message: 'ok',
        }),
      });
      const paymentGroups = settings
        .filter((setting) => setting.tab === 'payment')
        .map((setting) => setting.group.id);
      const paymentGroupNames = groups
        .filter((group) => group.tab === 'payment')
        .map((group) => group.name);
      const paymentFormProviders = forms.map((form) => {
        const passby = form.passby as { provider?: string } | undefined;
        return passby?.provider ?? '';
      });

      assert.equal(tabs.includes('payment'), true);
      assert.deepEqual([...new Set(paymentGroups)], ['stripe']);
      assert.deepEqual(paymentGroupNames, ['stripe']);
      assert.deepEqual(paymentFormProviders, ['stripe']);
      assert.equal(forms.every((form) => form.fields.length > 0), true);
    } finally {
      siteModule.site.capabilities.payment = originalCapability;
    }
  } finally {
    if (originalGeneratedSite === undefined) {
      delete process.env.NODE_ENV;
    }
    if (originalSite === undefined) {
      delete process.env.SITE;
    } else {
      process.env.SITE = originalSite;
    }
  }
});
