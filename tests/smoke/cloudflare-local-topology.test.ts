import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits';
import {
  findAvailablePort,
  prepareCloudflareLocalTopologyArtifacts,
  startCloudflareLocalDevTopology,
} from '../../scripts/lib/cloudflare-local-topology.mjs';

const {
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  getServerWorkerMetadata,
} = cloudflareWorkerSplits;

test('findAvailablePort 会跳过仅占用 127.0.0.1 的端口', async () => {
  const server = net.createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const nextPort = await findAvailablePort(address.port);
    assert.notEqual(nextPort, address.port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test('prepareCloudflareLocalTopologyArtifacts 会生成 router 和全部 server worker 配置，并注入同一组本地值', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'cf-local-topology-test-')
  );
  const devVarsPath = path.join(tempDir, '.dev.vars');
  const databaseUrl = 'postgresql://demo:demo@127.0.0.1:5432/demo';
  const routerBaseUrl = 'http://127.0.0.1:9787';

  try {
    const artifacts = await prepareCloudflareLocalTopologyArtifacts({
      databaseUrl,
      routerBaseUrl,
      authSecret: 'topology-secret-0123456789abcdef',
      devVarsPath,
      processEnv: {},
    });

    try {
      assert.equal(
        artifacts.serverWorkers.length,
        CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.length
      );

      const routerConfig = await fs.readFile(artifacts.router.configPath, 'utf8');
      assert.match(
        routerConfig,
        /localConnectionString = "postgresql:\/\/demo:demo@127\.0\.0\.1:5432\/demo"/
      );
      assert.match(
        routerConfig,
        /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:9787"/
      );
      assert.match(routerConfig, /\[dev\][\s\S]*host = "127\.0\.0\.1"/);
      assert.match(routerConfig, /\[dev\][\s\S]*upstream_protocol = "http"/);

      for (const worker of artifacts.serverWorkers) {
        const config = await fs.readFile(worker.configPath, 'utf8');
        assert.match(
          config,
          /localConnectionString = "postgresql:\/\/demo:demo@127\.0\.0\.1:5432\/demo"/
        );
        assert.match(
          config,
          /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:9787"/
        );
        assert.match(config, /\[dev\][\s\S]*host = "127\.0\.0\.1"/);
        assert.match(config, /\[dev\][\s\S]*upstream_protocol = "http"/);
      }

      const devVars = await fs.readFile(devVarsPath, 'utf8');
      assert.match(devVars, /AUTH_SECRET=topology-secret-0123456789abcdef/);
      assert.match(
        devVars,
        /BETTER_AUTH_SECRET=topology-secret-0123456789abcdef/
      );
      assert.match(devVars, /NEXT_PUBLIC_APP_URL=http:\/\/127\.0\.0\.1:9787/);
      assert.match(devVars, /AUTH_URL=http:\/\/127\.0\.0\.1:9787/);
      assert.match(devVars, /BETTER_AUTH_URL=http:\/\/127\.0\.0\.1:9787/);
      assert.match(devVars, /CF_LOCAL_SMOKE_WORKERS_DEV=true/);
    } finally {
      await artifacts.cleanup();
    }

    await assert.rejects(fs.stat(devVarsPath));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('prepareCloudflareLocalTopologyArtifacts 默认在临时 topology 目录内写入 .dev.vars', async () => {
  const databaseUrl = 'postgresql://demo:demo@127.0.0.1:5432/demo';

  const artifacts = await prepareCloudflareLocalTopologyArtifacts({
    databaseUrl,
    authSecret: 'topology-secret-0123456789abcdef',
    processEnv: {},
  });

  try {
    const expectedDevVarsPath = path.join(artifacts.tempDir, '.dev.vars');
    assert.equal(artifacts.devVars.devVarsPath, expectedDevVarsPath);

    const devVars = await fs.readFile(expectedDevVarsPath, 'utf8');
    assert.match(devVars, /AUTH_SECRET=topology-secret-0123456789abcdef/);
    assert.match(
      devVars,
      /BETTER_AUTH_SECRET=topology-secret-0123456789abcdef/
    );
  } finally {
    const tempDir = artifacts.tempDir;
    await artifacts.cleanup();
    await assert.rejects(fs.stat(tempDir));
  }
});

test('startCloudflareLocalDevTopology 先启动全部 server workers，再等待 ready，最后启动 router', async () => {
  const events: string[] = [];
  const readyResolvers = new Map<string, (value: string) => void>();
  const workerEnvs: Array<Record<string, string | undefined>> = [];
  const routerEnvs: Array<Record<string, string | undefined>> = [];
  let cleanupCount = 0;

  const startPromise = startCloudflareLocalDevTopology(
    {
      databaseUrl: 'postgresql://demo',
      authSecret: 'topology-secret-0123456789abcdef',
      processEnv: {},
    },
    {
      prepareCloudflareLocalTopologyArtifactsImpl: async () => ({
        router: {
          configPath: '/tmp/router.toml',
          label: 'Cloudflare preview',
          baseUrl: 'http://127.0.0.1:8787',
          port: 8787,
        },
        serverWorkers: CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target, index) => ({
          target,
          label: `Cloudflare server worker ${target}`,
          configPath: `/tmp/${target}.toml`,
          port: 8788 + index,
          workerName: getServerWorkerMetadata(target).workerName,
        })),
        async cleanup() {
          cleanupCount += 1;
        },
      }),
      createWranglerDevManagerImpl: ({ label, env }) => {
        events.push(`create:${label}`);
        workerEnvs.push({
          NEXT_PUBLIC_APP_URL: env?.NEXT_PUBLIC_APP_URL,
          AUTH_URL: env?.AUTH_URL,
          BETTER_AUTH_URL: env?.BETTER_AUTH_URL,
          CF_LOCAL_SMOKE_WORKERS_DEV: env?.CF_LOCAL_SMOKE_WORKERS_DEV,
        });
        const readyUrlPromise = new Promise<string>((resolve) => {
          readyResolvers.set(label, resolve);
        });

        return {
          label,
          recentLogs: [],
          readyUrlPromise,
          async stop() {
            events.push(`stop:${label}`);
          },
        };
      },
      createPreviewManagerImpl: ({ wranglerConfigPath, env }) => {
        events.push(`create:router:${wranglerConfigPath}`);
        routerEnvs.push({
          NEXT_PUBLIC_APP_URL: env?.NEXT_PUBLIC_APP_URL,
          AUTH_URL: env?.AUTH_URL,
          BETTER_AUTH_URL: env?.BETTER_AUTH_URL,
          CF_LOCAL_SMOKE_WORKERS_DEV: env?.CF_LOCAL_SMOKE_WORKERS_DEV,
        });

        return {
          label: 'Cloudflare preview',
          recentLogs: [],
          readyUrlPromise: Promise.resolve('http://127.0.0.1:8787'),
          async stop() {
            events.push('stop:router');
          },
        };
      },
    }
  );

  await Promise.resolve();

  assert.deepEqual(
    events,
    CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map(
      (target) => `create:Cloudflare server worker ${target}`
    )
  );

  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    readyResolvers
      .get(`Cloudflare server worker ${target}`)
      ?.(`http://127.0.0.1/${target}`);
  }

  const topology = await startPromise;
  assert.equal(events.at(-1), 'create:router:/tmp/router.toml');
  assert.deepEqual(workerEnvs, CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map(() => ({
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:8787',
    AUTH_URL: 'http://127.0.0.1:8787',
    BETTER_AUTH_URL: 'http://127.0.0.1:8787',
    CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
  })));
  assert.deepEqual(routerEnvs, [
    {
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:8787',
      AUTH_URL: 'http://127.0.0.1:8787',
      BETTER_AUTH_URL: 'http://127.0.0.1:8787',
      CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
    },
  ]);

  await topology.stop();

  assert.deepEqual(
    events.slice(-1 - CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.length),
    [
      'stop:router',
      ...[...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS]
        .reverse()
        .map((target) => `stop:Cloudflare server worker ${target}`),
    ]
  );
  assert.equal(cleanupCount, 1);
});

test('startCloudflareLocalDevTopology 在某个 server worker ready 前失败时返回带 label 的错误', async () => {
  let cleanupCount = 0;
  const failedTarget = 'public-web';

  await assert.rejects(
    startCloudflareLocalDevTopology(
      {
        databaseUrl: 'postgresql://demo',
        authSecret: 'topology-secret-0123456789abcdef',
        processEnv: {},
      },
      {
        prepareCloudflareLocalTopologyArtifactsImpl: async () => ({
          router: {
            configPath: '/tmp/router.toml',
            label: 'Cloudflare preview',
            baseUrl: 'http://127.0.0.1:8787',
            port: 8787,
          },
          serverWorkers: [
            {
              target: failedTarget,
              label: `Cloudflare server worker ${failedTarget}`,
              configPath: `/tmp/${failedTarget}.toml`,
              port: 8788,
              workerName: getServerWorkerMetadata(failedTarget).workerName,
            },
          ],
          async cleanup() {
            cleanupCount += 1;
          },
        }),
        createWranglerDevManagerImpl: ({ label }) => ({
          label,
          recentLogs: ['boom\n'],
          readyUrlPromise: Promise.reject(new Error('exited before ready')),
          async stop() {},
        }),
      }
    ),
    /Cloudflare server worker public-web failed to start: exited before ready/
  );

  assert.equal(cleanupCount, 1);
});
