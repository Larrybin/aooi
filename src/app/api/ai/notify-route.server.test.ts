import assert from 'node:assert/strict';
import test from 'node:test';

import { signAiNotifyCallback } from './notify/signature';

async function withNotifySecret<T>(
  value: string | undefined,
  run: () => Promise<T>
) {
  const previous = process.env.AI_NOTIFY_WEBHOOK_SECRET;
  try {
    if (value === undefined) {
      delete process.env.AI_NOTIFY_WEBHOOK_SECRET;
    } else {
      process.env.AI_NOTIFY_WEBHOOK_SECRET = value;
    }
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.AI_NOTIFY_WEBHOOK_SECRET;
    } else {
      process.env.AI_NOTIFY_WEBHOOK_SECRET = previous;
    }
  }
}

test('ai notify accepts valid signatures', async () => {
  await withNotifySecret('secret_1', async () => {
    const { POST } = await import('./notify/[provider]/route');
    const signature = await signAiNotifyCallback({
      provider: 'replicate',
      taskId: 'task_1',
      secret: 'secret_1',
    });
    const response = await POST(
      new Request(
        `http://localhost/api/ai/notify/replicate?task_id=task_1&sig=${signature}`,
        {
          method: 'POST',
          body: '{}',
        }
      ),
      { params: Promise.resolve({ provider: 'replicate' }) }
    );

    assert.equal(response.status, 200);
  });
});

test('ai notify rejects invalid signatures', async () => {
  await withNotifySecret('secret_1', async () => {
    const { POST } = await import('./notify/[provider]/route');
    const response = await POST(
      new Request(
        'http://localhost/api/ai/notify/replicate?task_id=task_1&sig=bad',
        {
          method: 'POST',
          body: '{}',
        }
      ),
      { params: Promise.resolve({ provider: 'replicate' }) }
    );

    assert.equal(response.status, 403);
  });
});

test('ai notify rejects when webhook secret is missing', async () => {
  await withNotifySecret(undefined, async () => {
    const { POST } = await import('./notify/[provider]/route');
    const response = await POST(
      new Request(
        'http://localhost/api/ai/notify/replicate?task_id=task_1&sig=bad',
        {
          method: 'POST',
          body: '{}',
        }
      ),
      { params: Promise.resolve({ provider: 'replicate' }) }
    );

    assert.equal(response.status, 503);
  });
});
