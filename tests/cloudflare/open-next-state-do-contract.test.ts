import assert from 'node:assert/strict';
import test from 'node:test';

const cloudflareContextSymbol = Symbol.for('__cloudflare-context__');

async function loadOpenNextConfig() {
  const module = await import('../../.open-next/.build/open-next.config.mjs');
  return module.default;
}

function withCloudflareContext<T>(
  context: {
    env: Record<string, unknown>;
    cf?: Record<string, unknown>;
    ctx?: {
      waitUntil?: (promise: Promise<unknown>) => void;
    };
  },
  run: () => Promise<T>
) {
  const previous = (globalThis as Record<symbol, unknown>)[cloudflareContextSymbol];
  (globalThis as Record<symbol, unknown>)[cloudflareContextSymbol] = context;
  const previousOpenNextConfig = (globalThis as Record<string, unknown>).openNextConfig;
  (globalThis as Record<string, unknown>).openNextConfig = {
    dangerous: {},
  };

  return run().finally(() => {
    if (previous === undefined) {
      delete (globalThis as Record<symbol, unknown>)[cloudflareContextSymbol];
    } else {
      (globalThis as Record<symbol, unknown>)[cloudflareContextSymbol] = previous;
    }

    if (previousOpenNextConfig === undefined) {
      delete (globalThis as Record<string, unknown>).openNextConfig;
      return;
    }
    (globalThis as Record<string, unknown>).openNextConfig = previousOpenNextConfig;
  });
}

test('OpenNext queue override 继续通过 NEXT_CACHE_DO_QUEUE.revalidate 投递 state 失效消息', async () => {
  const openNextConfig = await loadOpenNextConfig();
  const queue = openNextConfig.default.override.queue();
  let capturedIdFromName = '';
  let capturedRevalidatePayload: Record<string, unknown> | null = null;

  const durableObjectNamespace = {
    idFromName(name: string) {
      capturedIdFromName = name;
      return `do-id:${name}`;
    },
    get(id: string) {
      assert.equal(id, 'do-id:group-a');
      return {
        async revalidate(payload: Record<string, unknown>) {
          capturedRevalidatePayload = payload;
        },
      };
    },
  };

  await withCloudflareContext(
    {
      env: {
        NEXT_CACHE_DO_QUEUE: durableObjectNamespace,
      },
      ctx: {},
    },
    async () => {
      await queue.send({
        MessageGroupId: 'group-a',
        MessageDeduplicationId: 'dedupe-1',
        Body: {
          host: 'mamamiya.pdfreprinting.net',
          url: '/pricing',
        },
      });
    }
  );

  assert.equal(queue.name, 'durable-queue');
  assert.equal(capturedIdFromName, 'group-a');
  assert.deepEqual(capturedRevalidatePayload, {
    MessageGroupId: 'group-a',
    MessageDeduplicationId: 'dedupe-1',
    Body: {
      host: 'mamamiya.pdfreprinting.net',
      url: '/pricing',
    },
  });
});

test('OpenNext tag cache override 继续通过 NEXT_TAG_CACHE_DO_SHARDED 的 getTagData/writeTags 协议访问 state', async () => {
  const openNextConfig = await loadOpenNextConfig();
  const tagCache = openNextConfig.default.override.tagCache({
    regionalCache: false,
  });
  const waitUntilCalls: Promise<unknown>[] = [];
  const getCalls: Array<{ id: string; options?: { locationHint?: string } }> = [];
  const getTagDataCalls: string[][] = [];
  const writeTagsCalls: Array<Array<{ tag: string; stale?: number; expire?: number }>> = [];
  const tagDataByTag = {
    'plan:pro': {
      revalidatedAt: 1_500,
      stale: 1_500,
      expire: null,
    },
  };

  const durableObjectNamespace = {
    idFromName(name: string) {
      return name;
    },
    get(id: string, options?: { locationHint?: string }) {
      getCalls.push({ id, options });
      return {
        async getTagData(tags: string[]) {
          getTagDataCalls.push(tags);
          return Object.fromEntries(
            tags.map((tag) => [tag, tagDataByTag[tag as keyof typeof tagDataByTag] ?? null])
          );
        },
        async writeTags(tags: Array<{ tag: string; stale?: number; expire?: number }>) {
          writeTagsCalls.push(tags);
        },
      };
    },
  };

  await withCloudflareContext(
    {
      env: {
        NEXT_TAG_CACHE_DO_SHARDED: durableObjectNamespace,
      },
      cf: {
        continent: 'NA',
      },
      ctx: {
        waitUntil(promise: Promise<unknown>) {
          waitUntilCalls.push(promise);
        },
      },
    },
    async () => {
      const lastRevalidated = await tagCache.getLastRevalidated(['plan:pro']);
      const hasBeenRevalidated = await tagCache.hasBeenRevalidated(['plan:pro'], 1_000);
      await tagCache.writeTags(['plan:pro']);

      assert.equal(lastRevalidated, 1_500);
      assert.equal(hasBeenRevalidated, true);
    }
  );

  assert.equal(tagCache.name, 'do-sharded-tag-cache');
  assert.equal(getCalls.length > 0, true);
  assert.deepEqual(getTagDataCalls, [['plan:pro'], ['plan:pro']]);
  assert.equal(writeTagsCalls.length > 0, true);
  assert.equal(writeTagsCalls[0][0]?.tag, 'plan:pro');
  assert.equal(waitUntilCalls.length > 0, true);
});
