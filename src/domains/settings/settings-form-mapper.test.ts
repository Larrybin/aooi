import assert from 'node:assert/strict';
import test from 'node:test';

import { mapSettingsToForms } from './settings-form-mapper';
import type { SettingDefinition } from './types';

test('mapSettingsToForms: 仅映射当前 tab 并绑定提交处理器', () => {
  const submitHandler = async () => ({
    status: 'success' as const,
    message: 'ok',
  });

  const forms = mapSettingsToForms({
    tab: 'general',
    groups: [
      { name: 'general_ui', title: 'General UI', tab: 'general' as const },
      { name: 'payment_general', title: 'Payment', tab: 'payment' as const },
    ],
    settings: [
      {
        name: 'general_social_links_enabled',
        title: 'Social Links Enabled',
        type: 'switch',
        moduleId: 'core_shell',
        visibility: 'public',
        group: {
          id: 'general_ui',
          titleKey: 'groups.general_ui',
        },
        tab: 'general',
      },
      {
        name: 'stripe_key',
        title: 'Stripe Key',
        type: 'password',
        moduleId: 'billing',
        visibility: 'private',
        group: {
          id: 'payment_general',
          titleKey: 'groups.payment_general',
        },
        tab: 'payment',
      },
    ] satisfies readonly SettingDefinition[],
    configs: { general_social_links_enabled: 'true' },
    submitLabel: 'Save',
    onSubmit: submitHandler,
  });

  assert.equal(forms.length, 1);
  assert.equal(forms[0]?.title, 'General UI');
  assert.equal(forms[0]?.fields.length, 1);
  assert.equal(forms[0]?.fields[0]?.name, 'general_social_links_enabled');
  assert.equal(forms[0]?.submit?.button?.title, 'Save');
  assert.equal(forms[0]?.submit?.handler, submitHandler);
});
