import assert from 'node:assert/strict';
import test from 'node:test';

import { handleAuthSpikeOAuthMockRequest } from './oauth-spike.mock';

test('handleAuthSpikeOAuthMockRequest 返回 Google token mock 响应', async () => {
  const response = await handleAuthSpikeOAuthMockRequest(
    new Request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code: 'oauth-spike-google-success',
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    })
  );

  assert(response);
  const body = (await response.json()) as Record<string, string>;

  assert.equal(body.token_type, 'Bearer');
  assert.equal(body.scope, 'openid email profile');
  assert.match(body.id_token, /^[^.]+\.[^.]+\.$/);
});

test('handleAuthSpikeOAuthMockRequest 返回 GitHub profile mock 响应', async () => {
  const response = await handleAuthSpikeOAuthMockRequest(
    new Request('https://api.github.com/user', {
      method: 'GET',
      headers: {
        authorization: 'Bearer oauth-spike-github-access-token-success',
      },
    })
  );

  assert(response);
  const body = (await response.json()) as Record<string, string>;

  assert.equal(body.login, 'oauth-spike-github-user');
  assert.equal(body.email, 'oauth-spike-github@example.com');
});
