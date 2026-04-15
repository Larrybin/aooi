import assert from 'node:assert/strict';
import test from 'node:test';

import { mapSettingsToForms } from './settings-form-mapper';

test('mapSettingsToForms: 仅映射当前 tab 并绑定提交处理器', () => {
  const submitHandler = async () => ({
    status: 'success' as const,
    message: 'ok',
  });

  const forms = mapSettingsToForms({
    tab: 'general',
    groups: [
      { name: 'general_brand', title: 'Brand', tab: 'general' as const },
      { name: 'payment_general', title: 'Payment', tab: 'payment' as const },
    ],
    settings: [
      {
        name: 'app_name',
        title: 'App Name',
        type: 'text',
        group: 'general_brand',
        tab: 'general',
      },
      {
        name: 'stripe_key',
        title: 'Stripe Key',
        type: 'password',
        group: 'payment_general',
        tab: 'payment',
      },
    ],
    configs: { app_name: 'Demo' },
    submitLabel: 'Save',
    onSubmit: submitHandler,
  });

  assert.equal(forms.length, 1);
  assert.equal(forms[0]?.title, 'Brand');
  assert.equal(forms[0]?.fields.length, 1);
  assert.equal(forms[0]?.fields[0]?.name, 'app_name');
  assert.equal(forms[0]?.submit?.button?.title, 'Save');
  assert.equal(forms[0]?.submit?.handler, submitHandler);
});
