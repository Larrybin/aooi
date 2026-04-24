import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildNodeAuthSpikeEnv,
  detectReusableNodeServer,
  prepareLocalAuthSpikeDevVars,
  readNextDevLockBaseUrl,
  readWranglerLocalConnectionString,
  waitForNodeReady,
} from '../../scripts/run-local-auth-spike.mjs';

function createSilentConsole(): Console {
  return Object.assign(Object.create(console), console, {
    log: () => undefined,
  });
}

test('readWranglerLocalConnectionString 读取 Hyperdrive 本地连接串', () => {
  const connectionString = readWranglerLocalConnectionString(`
name = "demo"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "id_123"
localConnectionString = "postgresql://demo:demo@127.0.0.1:5432/demo"
`);

  assert.equal(connectionString, 'postgresql://demo:demo@127.0.0.1:5432/demo');
});

test('buildNodeAuthSpikeEnv 为本地 Node 面注入 auth/database 关键环境变量', () => {
  const env = buildNodeAuthSpikeEnv(
    { NODE_ENV: 'test' },
    {
      databaseUrl: 'postgresql://demo:demo@127.0.0.1:5432/demo',
      authSecret: 'secret_123',
      appUrl: 'http://127.0.0.1:3000',
    }
  );

  assert.equal(env.DATABASE_URL, 'postgresql://demo:demo@127.0.0.1:5432/demo');
  assert.equal(env.DEPLOY_TARGET, 'vercel');
  assert.equal(env.NEXT_PUBLIC_APP_URL, 'http://127.0.0.1:3000');
  assert.equal(env.BETTER_AUTH_URL, 'http://127.0.0.1:3000');
  assert.equal(env.AUTH_SECRET, 'secret_123');
  assert.equal(env.BETTER_AUTH_SECRET, 'secret_123');
  assert.equal(env.VERCEL, '1');
});

test('buildNodeAuthSpikeEnv 默认使用满足 Better Auth 长度要求的 secret', () => {
  const env = buildNodeAuthSpikeEnv(
    { NODE_ENV: 'test' },
    {
      databaseUrl: 'postgresql://demo:demo@127.0.0.1:5432/demo',
      appUrl: 'http://127.0.0.1:3000',
    }
  );

  assert.equal(typeof env.AUTH_SECRET, 'string');
  assert.equal(typeof env.BETTER_AUTH_SECRET, 'string');
  assert.equal(env.AUTH_SECRET, env.BETTER_AUTH_SECRET);
  assert.ok((env.AUTH_SECRET || '').length >= 32);
});

test('readNextDevLockBaseUrl 优先读取 lock 中的 appUrl', () => {
  const baseUrl = readNextDevLockBaseUrl(
    JSON.stringify({
      pid: 388,
      port: 3100,
      hostname: 'localhost',
      appUrl: 'http://localhost:3100',
    })
  );

  assert.equal(baseUrl, 'http://localhost:3100');
});

test('readNextDevLockBaseUrl 在缺少 appUrl 时回退端口', () => {
  const baseUrl = readNextDevLockBaseUrl(
    JSON.stringify({
      pid: 388,
      port: 3100,
      hostname: 'localhost',
    })
  );

  assert.equal(baseUrl, 'http://127.0.0.1:3100');
});

test('waitForNodeReady 在 sign-in 页面可达时完成', async () => {
  const fetchCalls: string[] = [];
  const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input));
    return new Response('<html>ok</html>', { status: 200 });
  }) as typeof fetch;

  await waitForNodeReady({
    baseUrl: 'http://127.0.0.1:3000',
    fetchImpl: fakeFetch,
    logger: createSilentConsole(),
    timeoutMs: 500,
  });

  assert.deepEqual(fetchCalls, ['http://127.0.0.1:3000/sign-in']);
});

test('detectReusableNodeServer 在目标地址已就绪时返回 true', async () => {
  const reusable = await detectReusableNodeServer({
    baseUrl: 'http://127.0.0.1:3000',
    fetchImpl: (async () =>
      new Response('<html>ok</html>', {
        status: 200,
      })) as typeof fetch,
    logger: createSilentConsole(),
    timeoutMs: 100,
  });

  assert.equal(reusable, true);
});

test('detectReusableNodeServer 在目标地址未就绪时返回 false', async () => {
  const reusable = await detectReusableNodeServer({
    baseUrl: 'http://127.0.0.1:3000',
    fetchImpl: (async () => {
      throw new Error('connect ECONNREFUSED');
    }) as typeof fetch,
    logger: createSilentConsole(),
    timeoutMs: 50,
  });

  assert.equal(reusable, false);
});

test('prepareLocalAuthSpikeDevVars 默认写入 .tmp 临时文件且不污染仓库根 .dev.vars', async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'local-auth-spike-'));
  const rootDevVarsPath = path.resolve(process.cwd(), '.dev.vars');
  const rootBefore = await readFile(rootDevVarsPath, 'utf8');

  const prepared = await prepareLocalAuthSpikeDevVars({
    authSecret: 'local-auth-spike-secret',
    tmpRoot,
  });

  assert.notEqual(prepared.devVarsPath, rootDevVarsPath);

  const tempContent = await readFile(prepared.devVarsPath, 'utf8');
  assert.equal(
    tempContent,
    'AUTH_SECRET=local-auth-spike-secret\nBETTER_AUTH_SECRET=local-auth-spike-secret\nDEPLOY_TARGET=cloudflare\n'
  );
  assert.equal(await readFile(rootDevVarsPath, 'utf8'), rootBefore);

  await prepared.cleanup();
  await assert.rejects(() => readFile(prepared.devVarsPath, 'utf8'));
  assert.equal(await readFile(rootDevVarsPath, 'utf8'), rootBefore);
});
