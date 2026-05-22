import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  authenticateSmokeUser,
  buildRemoverWorkersAILocalTopologyExtraVars,
  createRemoverUploadMultipartBody,
  createRemoverWorkersAISpikeImages,
  resolveSmokeAuthSession,
  runRemoverWorkersAISpikeAgainstBaseUrl,
  runWithRemoverTopologyExitGuard,
  waitForRemoverApiReady,
} from '../../scripts/run-remover-workers-ai-spike.mjs';

const model = '@cf/runwayml/stable-diffusion-v1-5-inpainting';

function ok(data: unknown, status = 200, init: ResponseInit = {}) {
  return Response.json(
    { code: 0, message: 'ok', data },
    {
      ...init,
      status,
    }
  );
}

test('createRemoverWorkersAISpikeImages returns PNG original and mask fixtures', () => {
  const images = createRemoverWorkersAISpikeImages();
  const pngSignature = '89504e470d0a1a0a';

  assert.equal(images.width, 512);
  assert.equal(images.height, 512);
  assert.equal(images.original.subarray(0, 8).toString('hex'), pngSignature);
  assert.equal(images.mask.subarray(0, 8).toString('hex'), pngSignature);
  assert.ok(images.original.length > 1000);
  assert.ok(images.mask.length > 1000);
});

test('buildRemoverWorkersAILocalTopologyExtraVars leaves auth origin to local topology', () => {
  assert.deepEqual(
    buildRemoverWorkersAILocalTopologyExtraVars({
      model,
    }),
    {
      REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
      REMOVER_AI_MODEL: model,
    }
  );
});

test('runWithRemoverTopologyExitGuard fails when Wrangler topology exits after ready', async () => {
  const child = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
  });

  const guarded = runWithRemoverTopologyExitGuard(
    {
      manager: {
        child,
      },
    },
    async () => new Promise(() => undefined)
  );

  child.emit('exit', 1, null);

  await assert.rejects(
    guarded,
    /Cloudflare local topology exited during remover Workers AI spike \(code=1\)/u
  );
});

test('waitForRemoverApiReady treats remover validation errors as readiness', async () => {
  const calls: string[] = [];

  await waitForRemoverApiReady({
    baseUrl: 'http://127.0.0.1:8787/',
    timeoutMs: 500,
    logger: {
      log: () => undefined,
    } as never,
    fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(String(input));
      assert.equal(init?.method, 'POST');
      assert.equal(init?.body, '{}');
      return Response.json(
        { code: 400, message: 'invalid body' },
        {
          status: 400,
        }
      );
    },
  });

  assert.deepEqual(calls, ['http://127.0.0.1:8787/api/remover/jobs']);
});

test('createRemoverUploadMultipartBody includes content length for Wrangler upload parsing', () => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const multipart = createRemoverUploadMultipartBody({
    kind: 'original',
    fileName: 'fixture.png',
    image,
    width: 512,
    height: 512,
  });
  const text = multipart.bodyBytes.toString('latin1');

  assert.match(multipart.contentType, /^multipart\/form-data; boundary=/u);
  assert.equal(multipart.body.type, multipart.contentType);
  assert.equal(multipart.contentLength, String(multipart.bodyBytes.byteLength));
  assert.equal(multipart.body.size, multipart.bodyBytes.byteLength);
  assert.match(text, /name="kind"\r\n\r\noriginal/u);
  assert.match(text, /name="width"\r\n\r\n512/u);
  assert.match(text, /name="height"\r\n\r\n512/u);
  assert.match(text, /name="image"; filename="fixture\.png"/u);
  assert.ok(multipart.bodyBytes.includes(image));
});

test('runRemoverWorkersAISpikeAgainstBaseUrl uploads assets and creates a Workers AI remover job', async () => {
  const calls: Array<{
    url: string;
    method: string;
    body: BodyInit | null | undefined;
  }> = [];
  let uploadCount = 0;

  async function fetchImpl(input: string | URL | Request, init?: RequestInit) {
    const url = String(input);
    calls.push({
      url,
      method: init?.method || 'GET',
      body: init?.body,
    });

    if (url.endsWith('/api/remover/upload')) {
      uploadCount += 1;
      if (uploadCount === 1) {
        assert.equal(
          (init?.headers as Record<string, string>).Cookie,
          undefined
        );
      } else {
        assert.equal(
          (init?.headers as Record<string, string>).Cookie,
          'remover_session=signed_session'
        );
      }
      assert.ok(init?.body instanceof Blob);
      assert.match(
        String((init.headers as Record<string, string>)['Content-Type']),
        /^multipart\/form-data; boundary=/u
      );
      assert.equal(
        (init.headers as Record<string, string>)['Content-Length'],
        undefined
      );
      const bodyText = Buffer.from(await init.body.arrayBuffer()).toString(
        'latin1'
      );
      const kind = bodyText.includes('\r\n\r\nmask\r\n') ? 'mask' : 'original';
      assert.match(bodyText, /name="width"\r\n\r\n512/u);
      assert.match(bodyText, /name="height"\r\n\r\n512/u);
      assert.match(bodyText, /name="image"; filename="workers-ai-spike-/u);

      return ok(
        {
          asset: {
            id: `${kind}-asset`,
            kind,
          },
          anonymousSessionId: 'anon_test',
        },
        200,
        uploadCount === 1
          ? {
              headers: {
                'Set-Cookie':
                  'remover_session=signed_session; Path=/; HttpOnly',
              },
            }
          : {}
      );
    }

    if (url.endsWith('/api/remover/jobs')) {
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'remover_session=signed_session'
      );
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.inputImageAssetId, 'original-asset');
      assert.equal(body.maskImageAssetId, 'mask-asset');
      assert.match(body.idempotencyKey, /^workers-ai-spike-/u);

      return ok(
        {
          reused: false,
          job: {
            id: 'job_test',
            status: 'succeeded',
            lowResDownloadAvailable: true,
            highResDownloadRequiresSignIn: true,
          },
        },
        201
      );
    }

    if (url.endsWith('/api/remover/download/low-res')) {
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'remover_session=signed_session'
      );
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.jobId, 'job_test');

      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      });
    }

    throw new Error(`unexpected request ${url}`);
  }

  const result = await runRemoverWorkersAISpikeAgainstBaseUrl({
    baseUrl: 'http://127.0.0.1:8787/',
    fetchImpl,
    model,
  });

  assert.equal(uploadCount, 2);
  assert.deepEqual(
    calls.map((call) => [call.method, call.url]),
    [
      ['POST', 'http://127.0.0.1:8787/api/remover/upload'],
      ['POST', 'http://127.0.0.1:8787/api/remover/upload'],
      ['POST', 'http://127.0.0.1:8787/api/remover/jobs'],
      ['POST', 'http://127.0.0.1:8787/api/remover/download/low-res'],
    ]
  );
  assert.deepEqual(result, {
    jobId: 'job_test',
    status: 'succeeded',
    lowResContentType: 'image/png',
    lowResBytes: 4,
    highResDownloadRequiresSignIn: true,
    anonymousSessionId: 'anon_test',
    authenticated: false,
  });
});

test('runRemoverWorkersAISpikeAgainstBaseUrl sends auth cookie and downloads high-res in authenticated mode', async () => {
  const calls: Array<[string, string]> = [];
  let uploadCount = 0;

  async function fetchImpl(input: string | URL | Request, init?: RequestInit) {
    const url = String(input);
    calls.push([init?.method || 'GET', url]);

    if (url.endsWith('/api/remover/upload')) {
      uploadCount += 1;
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'better-auth.session_token=session_1'
      );
      const bodyText = Buffer.from(
        await (init?.body as Blob).arrayBuffer()
      ).toString('latin1');
      const kind = bodyText.includes('\r\n\r\nmask\r\n') ? 'mask' : 'original';
      return ok({
        asset: {
          id: `${kind}-asset`,
          kind,
        },
      });
    }

    if (url.endsWith('/api/remover/jobs')) {
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'better-auth.session_token=session_1'
      );
      return ok(
        {
          reused: false,
          job: {
            id: 'job_user_test',
            status: 'succeeded',
            lowResDownloadAvailable: true,
            highResDownloadRequiresSignIn: false,
          },
        },
        201
      );
    }

    if (url.endsWith('/api/remover/download/low-res')) {
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'better-auth.session_token=session_1'
      );
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      });
    }

    if (url.endsWith('/api/remover/download/high-res')) {
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'better-auth.session_token=session_1'
      );
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      });
    }

    throw new Error(`unexpected request ${url}`);
  }

  const result = await runRemoverWorkersAISpikeAgainstBaseUrl({
    baseUrl: 'http://127.0.0.1:8787/',
    fetchImpl,
    initialCookieHeader: 'better-auth.session_token=session_1',
    authenticated: true,
  });

  assert.equal(uploadCount, 2);
  assert.deepEqual(calls, [
    ['POST', 'http://127.0.0.1:8787/api/remover/upload'],
    ['POST', 'http://127.0.0.1:8787/api/remover/upload'],
    ['POST', 'http://127.0.0.1:8787/api/remover/jobs'],
    ['POST', 'http://127.0.0.1:8787/api/remover/download/low-res'],
    ['POST', 'http://127.0.0.1:8787/api/remover/download/high-res'],
  ]);
  assert.deepEqual(result, {
    jobId: 'job_user_test',
    status: 'succeeded',
    lowResContentType: 'image/png',
    lowResBytes: 4,
    highResContentType: 'image/png',
    highResBytes: 5,
    highResDownloadRequiresSignIn: false,
    anonymousSessionId: '',
    authenticated: true,
  });
});

test('authenticateSmokeUser signs in without creating users by default', async () => {
  const calls: string[] = [];

  const cookie = await authenticateSmokeUser({
    baseUrl: 'http://127.0.0.1:8787/',
    email: 'smoke@example.com',
    password: 'password',
    fetchImpl: async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/api/auth/sign-in/email')) {
        return Response.json(
          { user: { id: 'user_1' } },
          {
            status: 200,
            headers: {
              'Set-Cookie':
                'better-auth.session_token=session_1; Path=/; HttpOnly',
            },
          }
        );
      }

      throw new Error(`unexpected request ${url}`);
    },
  });

  assert.deepEqual(calls, ['http://127.0.0.1:8787/api/auth/sign-in/email']);
  assert.equal(cookie, 'better-auth.session_token=session_1');
});

test('authenticateSmokeUser only signs up when explicitly allowed', async () => {
  const calls: string[] = [];

  const cookie = await authenticateSmokeUser({
    baseUrl: 'http://127.0.0.1:8787/',
    email: 'smoke@example.com',
    password: 'password',
    allowSignup: true,
    fetchImpl: async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/api/auth/sign-in/email')) {
        return Response.json(
          { message: 'invalid credentials' },
          { status: 401 }
        );
      }

      if (url.endsWith('/api/auth/sign-up/email')) {
        return Response.json(
          { user: { id: 'user_1' } },
          {
            status: 200,
            headers: {
              'Set-Cookie':
                'better-auth.session_token=session_1; Path=/; HttpOnly',
            },
          }
        );
      }

      throw new Error(`unexpected request ${url}`);
    },
  });

  assert.deepEqual(calls, [
    'http://127.0.0.1:8787/api/auth/sign-in/email',
    'http://127.0.0.1:8787/api/auth/sign-up/email',
  ]);
  assert.equal(cookie, 'better-auth.session_token=session_1');
});

test('authenticateSmokeUser rejects automatic sign-up in production', async () => {
  await assert.rejects(
    authenticateSmokeUser({
      baseUrl: 'http://127.0.0.1:8787/',
      email: 'smoke@example.com',
      password: 'password',
      allowSignup: true,
      appEnvironment: 'production',
      fetchImpl: async () => {
        throw new Error('should not call auth');
      },
    }),
    /not allowed in production/u
  );
});

test('resolveSmokeAuthSession requires credentials for release smoke', async () => {
  const previousEmail = process.env.SMOKE_AUTH_EMAIL;
  const previousPassword = process.env.SMOKE_AUTH_PASSWORD;
  try {
    delete process.env.SMOKE_AUTH_EMAIL;
    delete process.env.SMOKE_AUTH_PASSWORD;

    await assert.rejects(
      resolveSmokeAuthSession({
        baseUrl: 'http://127.0.0.1:8787/',
        authRequired: true,
      }),
      /requires SMOKE_AUTH_EMAIL and SMOKE_AUTH_PASSWORD/u
    );
  } finally {
    if (previousEmail === undefined) {
      delete process.env.SMOKE_AUTH_EMAIL;
    } else {
      process.env.SMOKE_AUTH_EMAIL = previousEmail;
    }
    if (previousPassword === undefined) {
      delete process.env.SMOKE_AUTH_PASSWORD;
    } else {
      process.env.SMOKE_AUTH_PASSWORD = previousPassword;
    }
  }
});

test('resolveSmokeAuthSession still supports explicit anonymous mode', async () => {
  const previousEmail = process.env.SMOKE_AUTH_EMAIL;
  const previousPassword = process.env.SMOKE_AUTH_PASSWORD;
  try {
    delete process.env.SMOKE_AUTH_EMAIL;
    delete process.env.SMOKE_AUTH_PASSWORD;

    assert.deepEqual(
      await resolveSmokeAuthSession({
        baseUrl: 'http://127.0.0.1:8787/',
        authRequired: false,
      }),
      {
        initialCookieHeader: '',
        authenticated: false,
      }
    );
  } finally {
    if (previousEmail === undefined) {
      delete process.env.SMOKE_AUTH_EMAIL;
    } else {
      process.env.SMOKE_AUTH_EMAIL = previousEmail;
    }
    if (previousPassword === undefined) {
      delete process.env.SMOKE_AUTH_PASSWORD;
    } else {
      process.env.SMOKE_AUTH_PASSWORD = previousPassword;
    }
  }
});

test('runRemoverWorkersAISpikeAgainstBaseUrl rejects leaked internal job fields', async () => {
  async function fetchImpl(input: string | URL | Request, init?: RequestInit) {
    const url = String(input);

    if (url.endsWith('/api/remover/upload')) {
      assert.ok(init?.body instanceof Blob);
      const bodyText = Buffer.from(await init.body.arrayBuffer()).toString(
        'latin1'
      );
      const kind = bodyText.includes('\r\n\r\nmask\r\n') ? 'mask' : 'original';
      return ok({
        asset: {
          id: `${kind}-asset`,
          kind,
        },
        anonymousSessionId: 'anon_test',
      });
    }

    if (url.endsWith('/api/remover/jobs')) {
      return ok(
        {
          reused: false,
          job: {
            id: 'job_test',
            status: 'succeeded',
            lowResDownloadAvailable: true,
            highResDownloadRequiresSignIn: true,
            outputImageKey: 'remover/anonymous/anon_test/output/job_test.png',
          },
        },
        201
      );
    }

    throw new Error(`unexpected request ${url}`);
  }

  await assert.rejects(
    runRemoverWorkersAISpikeAgainstBaseUrl({
      baseUrl: 'http://127.0.0.1:8787/',
      fetchImpl,
      model,
    }),
    /create remover job exposed internal job field: outputImageKey/u
  );
});
