import assert from 'node:assert/strict';
import test from 'node:test';

import { assertEmailCapabilityContract } from './contract';

test('assertEmailCapabilityContract 只依赖显式 snapshot 且缺 sender 时失败', () => {
  assert.throws(
    () =>
      assertEmailCapabilityContract({
        settings: {
          resendSenderEmail: '',
        },
        bindings: {
          resendApiKey: 'resend-key',
        },
      }),
    /resend_sender_email is required/
  );
});

test('assertEmailCapabilityContract 缺 RESEND_API_KEY 时失败', () => {
  assert.throws(
    () =>
      assertEmailCapabilityContract({
        settings: {
          resendSenderEmail: 'ops@example.com',
        },
        bindings: {
          resendApiKey: '',
        },
      }),
    /RESEND_API_KEY is required/
  );
});

test('assertEmailCapabilityContract 返回纯净闭合 contract', () => {
  const contract = assertEmailCapabilityContract({
    settings: {
      resendSenderEmail: ' ops@example.com ',
    },
    bindings: {
      resendApiKey: ' resend-key ',
    },
  });

  assert.deepEqual(contract, {
    provider: 'resend',
    resendSenderEmail: 'ops@example.com',
    resendApiKey: 'resend-key',
  });
  assert.equal('configs' in (contract as Record<string, unknown>), false);
});
