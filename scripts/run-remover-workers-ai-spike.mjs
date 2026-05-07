import '@/config/load-dotenv';

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { resolveCloudflareAuthSecretValue } from './create-cf-secrets-file.mjs';
import {
  renderCloudflareLocalTopologyLogs,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { waitForPreviewReady } from './lib/cloudflare-preview-smoke.mjs';
import { runPhaseSequence } from './lib/harness/scenario.mjs';
import {
  injectCloudflareLocalSmokeDevVars,
  resolveLocalSmokeDatabaseUrl,
} from './run-cf-local-smoke.mjs';

const defaultBaseUrl = 'http://localhost:8787';
const defaultAuthSecret = 'local-cloudflare-ai-remover-spike-0123456789';
const defaultModel = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
const imageSize = 512;

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  return Buffer.concat([
    writeUInt32(data.length),
    typeBuffer,
    data,
    writeUInt32(crc32(Buffer.concat([typeBuffer, data]))),
  ]);
}

function createPng({ width, height, pixelAt }) {
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixelAt(x, y);
      const offset = rowOffset + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  return Buffer.concat([
    header,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createRemoverWorkersAISpikeImages() {
  const objectMin = Math.floor(imageSize * 0.36);
  const objectMax = Math.floor(imageSize * 0.64);

  const original = createPng({
    width: imageSize,
    height: imageSize,
    pixelAt(x, y) {
      if (x >= objectMin && x <= objectMax && y >= objectMin && y <= objectMax) {
        return [207, 73, 55, 255];
      }

      const shade = 222 + Math.floor((x + y) / 64) % 18;
      return [shade, shade + 4, 235, 255];
    },
  });

  const mask = createPng({
    width: imageSize,
    height: imageSize,
    pixelAt(x, y) {
      const selected =
        x >= objectMin - 8 &&
        x <= objectMax + 8 &&
        y >= objectMin - 8 &&
        y <= objectMax + 8;
      return selected ? [255, 255, 255, 255] : [0, 0, 0, 255];
    },
  });

  return { original, mask, width: imageSize, height: imageSize };
}

async function readApiEnvelope(response, label) {
  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON ${response.status}: ${text}`);
  }

  if (!response.ok || payload.code !== 0) {
    throw new Error(
      `${label} failed ${response.status}: ${payload.message || text}`
    );
  }

  return payload.data;
}

function createHeaders({ baseUrl, userAgent, clientIp }) {
  return {
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    'User-Agent': userAgent,
    'X-Real-IP': clientIp,
  };
}

async function uploadRemoverAsset({
  baseUrl,
  fetchImpl,
  kind,
  fileName,
  image,
  width,
  height,
  headers,
}) {
  const formData = new FormData();
  formData.set('kind', kind);
  formData.set('width', String(width));
  formData.set('height', String(height));
  formData.set(
    'image',
    new Blob([new Uint8Array(image)], { type: 'image/png' }),
    fileName
  );

  const response = await fetchImpl(`${baseUrl}/api/remover/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await readApiEnvelope(response, `upload ${kind}`);

  if (!data?.asset?.id) {
    throw new Error(`upload ${kind} did not return an asset id`);
  }

  return data;
}

async function createRemoverJob({
  baseUrl,
  fetchImpl,
  inputImageAssetId,
  maskImageAssetId,
  idempotencyKey,
  headers,
}) {
  const response = await fetchImpl(`${baseUrl}/api/remover/jobs`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputImageAssetId,
      maskImageAssetId,
      idempotencyKey,
    }),
  });
  return readApiEnvelope(response, 'create remover job');
}

async function fetchRemoverJob({ baseUrl, fetchImpl, jobId, headers }) {
  const response = await fetchImpl(`${baseUrl}/api/remover/jobs/${jobId}`, {
    method: 'GET',
    headers,
  });
  const data = await readApiEnvelope(response, 'get remover job');

  if (!data?.job?.id) {
    throw new Error('get remover job did not return a job');
  }

  return data.job;
}

async function downloadLowResRemoverResult({
  baseUrl,
  fetchImpl,
  jobId,
  headers,
}) {
  const response = await fetchImpl(`${baseUrl}/api/remover/download/low-res`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`download low-res failed ${response.status}: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`download low-res returned ${contentType || 'no content-type'}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('download low-res returned an empty image');
  }

  return {
    contentType,
    bytes,
  };
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForRemoverJob({
  baseUrl,
  fetchImpl,
  initialJob,
  headers,
  timeoutMs,
}) {
  const startedAt = Date.now();
  let job = initialJob;

  while (job.status !== 'succeeded' && job.status !== 'failed') {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`remover job ${job.id} did not finish before timeout`);
    }

    await sleep(2000);
    job = await fetchRemoverJob({
      baseUrl,
      fetchImpl,
      jobId: job.id,
      headers,
    });
  }

  return job;
}

export async function runRemoverWorkersAISpikeAgainstBaseUrl({
  baseUrl,
  fetchImpl = fetch,
  model = defaultModel,
  timeoutMs = 90000,
  userAgent = 'aooi-remover-workers-ai-spike/1.0',
  clientIp = '127.0.0.1',
} = {}) {
  if (!baseUrl) {
    throw new Error('baseUrl is required');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, '');
  const images = createRemoverWorkersAISpikeImages();
  const headers = createHeaders({
    baseUrl: normalizedBaseUrl,
    userAgent,
    clientIp,
  });
  const inputUpload = await uploadRemoverAsset({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    kind: 'original',
    fileName: 'workers-ai-spike-original.png',
    image: images.original,
    width: images.width,
    height: images.height,
    headers,
  });
  const maskUpload = await uploadRemoverAsset({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    kind: 'mask',
    fileName: 'workers-ai-spike-mask.png',
    image: images.mask,
    width: images.width,
    height: images.height,
    headers,
  });
  const created = await createRemoverJob({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    inputImageAssetId: inputUpload.asset.id,
    maskImageAssetId: maskUpload.asset.id,
    idempotencyKey: `workers-ai-spike-${randomUUID()}`,
    headers,
  });
  const job = await waitForRemoverJob({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    initialJob: created.job,
    headers,
    timeoutMs,
  });

  if (job.status !== 'succeeded') {
    throw new Error(
      `remover job ${job.id} failed: ${job.errorMessage || job.errorCode || 'unknown error'}`
    );
  }

  if (job.provider !== 'cloudflare-workers-ai') {
    throw new Error(`expected cloudflare-workers-ai provider, got ${job.provider}`);
  }

  if (job.model !== model) {
    throw new Error(`expected model ${model}, got ${job.model}`);
  }

  if (!job.outputImageKey) {
    throw new Error('succeeded remover job did not store outputImageKey');
  }

  const lowResDownload = await downloadLowResRemoverResult({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    jobId: job.id,
    headers,
  });

  return {
    jobId: job.id,
    provider: job.provider,
    model: job.model,
    outputImageKey: job.outputImageKey,
    lowResContentType: lowResDownload.contentType,
    lowResBytes: lowResDownload.bytes.length,
    highResDownloadRequiresSignIn: Boolean(job.highResDownloadRequiresSignIn),
    anonymousSessionId:
      inputUpload.anonymousSessionId || maskUpload.anonymousSessionId || '',
  };
}

export async function runLocalRemoverWorkersAISpike({
  baseUrl = defaultBaseUrl,
  databaseUrl = resolveLocalSmokeDatabaseUrl(),
  model = process.env.REMOVER_AI_MODEL?.trim() || defaultModel,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required for local Workers AI remover spike'
    );
  }

  const authSecret = resolveCloudflareAuthSecretValue(process.env, {
    fallbackAuthSecret: defaultAuthSecret,
  });
  const topology = await startCloudflareLocalDevTopology({
    databaseUrl,
    routerBaseUrl: baseUrl,
    authSecret,
    extraVars: {
      REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
      REMOVER_AI_MODEL: model,
    },
  });
  const resolvedBaseUrl = topology.getRouterBaseUrl();

  try {
    let result;
    await runPhaseSequence({
      phases: [
        {
          label: 'preview-ready',
          action: async () => {
            await waitForPreviewReady({ baseUrl: resolvedBaseUrl });
          },
        },
        {
          label: 'remover-workers-ai',
          action: async () => {
            result = await runRemoverWorkersAISpikeAgainstBaseUrl({
              baseUrl: resolvedBaseUrl,
              model,
            });
          },
        },
      ],
    });

    return result;
  } catch (error) {
    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      console.error(recentLogs);
    }
    throw error;
  } finally {
    await topology.stop();
  }
}

async function main() {
  injectCloudflareLocalSmokeDevVars();

  const externalBaseUrl =
    process.env.REMOVER_WORKERS_AI_SPIKE_BASE_URL?.trim() || '';
  const model = process.env.REMOVER_AI_MODEL?.trim() || defaultModel;
  const result = externalBaseUrl
    ? await runRemoverWorkersAISpikeAgainstBaseUrl({
        baseUrl: externalBaseUrl,
        model,
      })
    : await runLocalRemoverWorkersAISpike({
        baseUrl: process.env.CF_LOCAL_SMOKE_URL?.trim() || defaultBaseUrl,
        model,
      });

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
      },
      null,
      2
    )
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
