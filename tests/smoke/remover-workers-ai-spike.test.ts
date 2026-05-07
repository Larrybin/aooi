import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRemoverWorkersAISpikeImages,
  runRemoverWorkersAISpikeAgainstBaseUrl,
} from '../../scripts/run-remover-workers-ai-spike.mjs';

const model = '@cf/runwayml/stable-diffusion-v1-5-inpainting';

function ok(data: unknown, status = 200) {
  return Response.json({ code: 0, message: 'ok', data }, { status });
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
      assert.ok(init?.body instanceof FormData);
      const kind = init.body.get('kind');
      assert.equal(init.body.get('width'), '512');
      assert.equal(init.body.get('height'), '512');
      assert.ok(init.body.get('image') instanceof Blob);

      return ok({
        asset: {
          id: `${kind}-asset`,
          kind,
        },
        anonymousSessionId: 'anon_test',
      });
    }

    if (url.endsWith('/api/remover/jobs')) {
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
            provider: 'cloudflare-workers-ai',
            model,
            outputImageKey: 'remover/anonymous/anon_test/output/job_test.png',
            outputImageUrl: '',
            highResDownloadRequiresSignIn: true,
          },
        },
        201
      );
    }

    if (url.endsWith('/api/remover/download/low-res')) {
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
    provider: 'cloudflare-workers-ai',
    model,
    outputImageKey: 'remover/anonymous/anon_test/output/job_test.png',
    lowResContentType: 'image/png',
    lowResBytes: 4,
    highResDownloadRequiresSignIn: true,
    anonymousSessionId: 'anon_test',
  });
});
