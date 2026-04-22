import '@/config/load-dotenv';

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

import * as localeModule from '../src/config/locale/index.ts';
import * as storagePublicUrlModule from '../src/shared/lib/storage-public-url.ts';
import * as configConsistencyModule from '../src/shared/lib/config-consistency.ts';
import * as settingsNormalizersModule from '../src/domains/settings/settings-normalizers.ts';
import {
  renderCloudflareLocalTopologyLogs,
  resolveCloudflareLocalDatabaseUrl,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import {
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
  waitForPreviewReady,
} from './lib/cloudflare-preview-smoke.mjs';
import { runPhaseSequence } from './lib/harness/scenario.mjs';
import { injectCloudflareLocalSmokeDevVars } from './run-cf-local-smoke.mjs';

injectCloudflareLocalSmokeDevVars();

const configConsistency =
  configConsistencyModule.default ?? configConsistencyModule;
const { CONFIG_CONSISTENCY_FRESH_VALUE, CONFIG_CONSISTENCY_HEADER } =
  configConsistency;
const FRESH_CONFIG_CONSISTENCY_HEADERS = Object.freeze({
  [CONFIG_CONSISTENCY_HEADER]: CONFIG_CONSISTENCY_FRESH_VALUE,
});

const localeConfig = localeModule.default ?? localeModule;
const { locales } = localeConfig;
const storagePublicUrl =
  storagePublicUrlModule.default ?? storagePublicUrlModule;
const { buildStorageObjectPublicUrl } = storagePublicUrl;
const settingsNormalizers =
  settingsNormalizersModule.default ?? settingsNormalizersModule;
const { normalizeSettingOverrides } = settingsNormalizers;

const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.CF_ADMIN_SETTINGS_SMOKE_REQUEST_TIMEOUT_MS || '30000',
  10
);
const STORAGE_PUBLIC_BASE_URL = 'https://storage-spike.example.com/assets/';
const SESSION_COOKIE_NAME = 'better-auth.session_token';
const SMOKE_CONFIG_NAMES = [
  'app_name',
  'app_url',
  'general_support_email',
  'storage_public_base_url',
  'app_logo',
  'app_favicon',
  'app_og_image',
];
const BRAND_UPLOAD_FILES = Object.freeze({
  appLogo: {
    fileName: 'cf-admin-settings-logo.png',
    mimeType: 'image/png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00],
  },
  appFavicon: {
    fileName: 'cf-admin-settings-favicon.ico',
    mimeType: 'image/x-icon',
    bytes: [0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00],
  },
  appOgImage: {
    fileName: 'cf-admin-settings-preview.png',
    mimeType: 'image/png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01],
  },
});

export function resolveSmokeLocales(
  allLocales = locales,
  rawValue = process.env.CF_ADMIN_SETTINGS_SMOKE_LOCALES
) {
  const requestedLocales = rawValue
    ?.split(',')
    .map((locale) => locale.trim())
    .filter(Boolean);

  if (!requestedLocales?.length) {
    return allLocales;
  }

  const unknownLocales = requestedLocales.filter(
    (locale) => !allLocales.includes(locale)
  );
  if (unknownLocales.length > 0) {
    throw new Error(
      `Unknown CF_ADMIN_SETTINGS_SMOKE_LOCALES entries: ${unknownLocales.join(', ')}`
    );
  }

  return requestedLocales;
}

export function buildExpectedPublicAssetUrls({
  storagePublicBaseUrl,
  objectKeys,
}) {
  return {
    appLogo: buildStorageObjectPublicUrl(
      objectKeys.appLogo,
      storagePublicBaseUrl
    ),
    appFavicon: buildStorageObjectPublicUrl(
      objectKeys.appFavicon,
      storagePublicBaseUrl
    ),
    appOgImage: buildStorageObjectPublicUrl(
      objectKeys.appOgImage,
      storagePublicBaseUrl
    ),
  };
}

export function normalizeSeedSettings(values) {
  const result = normalizeSettingOverrides(values);
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.value;
}

function createTempEmail(label) {
  return `cf-admin-settings-smoke+${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function createSessionToken() {
  return crypto.randomUUID().replaceAll('-', '');
}

function createSeedSettings(timestamp) {
  return {
    app_name: `CF Admin Settings ${timestamp}`,
    app_url: `https://brand-${timestamp}.example.com/path?ignored=1`,
    general_support_email: `Support.${timestamp}@EXAMPLE.COM`,
    storage_public_base_url: STORAGE_PUBLIC_BASE_URL,
  };
}

function safeParseJson(bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch {
    return null;
  }
}

function createSqlClient(databaseUrl) {
  return postgres(databaseUrl, {
    prepare: false,
    max: 1,
  });
}

export function buildSignedInSessionCookieHeader(sessionToken) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

async function captureConfigBaseline(databaseUrl, names) {
  const sql = createSqlClient(databaseUrl);

  try {
    const rows = await sql`select name, value from config`;
    const selectedRows = rows.filter((row) => names.includes(String(row.name)));

    return Object.fromEntries(
      names.map((name) => {
        const row = selectedRows.find((entry) => String(entry.name) === name);
        return [
          name,
          row
            ? { exists: true, value: String(row.value ?? '') }
            : { exists: false, value: '' },
        ];
      })
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function writeConfigsRaw(databaseUrl, values) {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return;
  }

  const sql = createSqlClient(databaseUrl);

  try {
    await sql.begin(async (tx) => {
      for (const [name, value] of entries) {
        await tx`
          insert into config (name, value)
          values (${name}, ${value})
          on conflict (name)
          do update set value = excluded.value
        `;
      }
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function deleteConfigs(databaseUrl, names) {
  if (names.length === 0) {
    return;
  }

  const sql = createSqlClient(databaseUrl);

  try {
    await sql.begin(async (tx) => {
      for (const name of names) {
        await tx`delete from config where name = ${name}`;
      }
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function writeConfigsNormalized(databaseUrl, values) {
  await writeConfigsRaw(databaseUrl, normalizeSeedSettings(values));
}

async function restoreConfigBaseline(databaseUrl, baseline) {
  const valuesToRestore = {};
  const namesToDelete = [];

  for (const [name, entry] of Object.entries(baseline)) {
    if (entry.exists) {
      valuesToRestore[name] = entry.value;
    } else {
      namesToDelete.push(name);
    }
  }

  await writeConfigsRaw(databaseUrl, valuesToRestore);
  await deleteConfigs(databaseUrl, namesToDelete);
}

async function seedSmokeUserSession(databaseUrl, smokeUser) {
  const sql = createSqlClient(databaseUrl);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const userId = crypto.randomUUID();
  const sessionToken = createSessionToken();

  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into "user" (
          id,
          name,
          email,
          email_verified,
          created_at,
          updated_at
        )
        values (
          ${userId},
          ${smokeUser.userName},
          ${smokeUser.email},
          ${true},
          ${now},
          ${now}
        )
      `;

      await tx`
        insert into session (
          id,
          expires_at,
          token,
          created_at,
          updated_at,
          ip_address,
          user_agent,
          user_id
        )
        values (
          ${crypto.randomUUID()},
          ${expiresAt},
          ${sessionToken},
          ${now},
          ${now},
          ${'127.0.0.1'},
          ${'cf-admin-settings-smoke'},
          ${userId}
        )
      `;
    });

    return {
      userId,
      sessionToken,
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function deleteSmokeUser(databaseUrl, userId) {
  if (!userId) {
    return;
  }

  const sql = createSqlClient(databaseUrl);

  try {
    await sql`delete from "user" where id = ${userId}`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function waitForAdminSettingsSmokeReady({
  baseUrl,
  waitForPreviewReadyImpl = waitForPreviewReady,
}) {
  await waitForPreviewReadyImpl({ baseUrl });
}

async function startPreviewTopology({
  databaseUrl,
  routerBaseUrl,
  authSecret,
}) {
  const topology = await startCloudflareLocalDevTopology({
    databaseUrl,
    routerBaseUrl,
    authSecret,
  });
  const baseUrl = topology.getRouterBaseUrl();

  await waitForAdminSettingsSmokeReady({ baseUrl });

  return {
    topology,
    baseUrl,
  };
}

async function fetchJson({ url, method = 'GET', headers, body }) {
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const bodyText = await response.text();

  return {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    bodyText,
    json: safeParseJson(bodyText),
  };
}

async function uploadStorageFileViaSession({ baseUrl, cookieHeader, file }) {
  const formData = new FormData();
  formData.set(
    'files',
    new File([Uint8Array.from(file.bytes)], file.fileName, {
      type: file.mimeType,
    })
  );

  return await fetchJson({
    url: `${baseUrl}/api/storage/upload-image`,
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      origin: baseUrl,
      referer: `${baseUrl}/`,
      ...FRESH_CONFIG_CONSISTENCY_HEADERS,
    },
    body: formData,
  });
}

async function uploadBrandAssetsViaSession({
  baseUrl,
  cookieHeader,
  storagePublicBaseUrl,
}) {
  const uploads = {};

  for (const [assetName, file] of Object.entries(BRAND_UPLOAD_FILES)) {
    const response = await uploadStorageFileViaSession({
      baseUrl,
      cookieHeader,
      file,
    });

    assert.equal(
      response.status,
      200,
      `[${assetName}] expected upload 200, got ${response.status}, body=${response.bodyText}`
    );
    assert.match(
      response.contentType,
      /application\/json/i,
      `[${assetName}] unexpected content-type: ${response.contentType || 'n/a'}`
    );
    assert.equal(
      response.json?.code,
      0,
      `[${assetName}] upload should return code=0, body=${response.bodyText}`
    );

    const result = response.json?.data?.results?.[0];
    assert.ok(result?.key, `[${assetName}] missing upload key`);
    assert.ok(result?.url, `[${assetName}] missing upload url`);
    assert.equal(
      result.url,
      buildStorageObjectPublicUrl(result.key, storagePublicBaseUrl),
      `[${assetName}] upload url must derive from storage_public_base_url + objectKey`
    );

    uploads[assetName] = result;
  }

  return uploads;
}

async function assertStorageUploadDenied({ baseUrl, cookieHeader }) {
  const response = await uploadStorageFileViaSession({
    baseUrl,
    cookieHeader,
    file: BRAND_UPLOAD_FILES.appLogo,
  });

  assert.equal(
    response.status,
    503,
    `expected denied upload 503, got ${response.status}, body=${response.bodyText}`
  );
  assert.equal(
    response.json?.message,
    'storage_public_base_url is not configured'
  );
}

async function fetchPublicConfigs(baseUrl) {
  const response = await fetchJson({
    url: `${baseUrl}/api/config/get-configs`,
    headers: FRESH_CONFIG_CONSISTENCY_HEADERS,
  });

  assert.equal(
    response.status,
    200,
    `[public-configs] expected 200, got ${response.status}, body=${response.bodyText}`
  );
  assert.match(
    response.contentType,
    /application\/json/i,
    `[public-configs] unexpected content-type: ${response.contentType || 'n/a'}`
  );
  assert.equal(
    response.json?.code,
    0,
    `[public-configs] expected code=0, body=${response.bodyText}`
  );

  return response.json?.data ?? {};
}

export function assertPublicBrandConfigProjection({
  publicConfigs,
  expectedAppName,
  expectedStoragePublicBaseUrl,
  expectedObjectKeys,
  expectedAssetUrls,
}) {
  assert.equal(
    publicConfigs.app_name,
    expectedAppName,
    '[public-configs] app_name should reflect seeded brand name'
  );
  assert.equal(
    publicConfigs.storage_public_base_url,
    expectedStoragePublicBaseUrl,
    '[public-configs] storage_public_base_url should remain publicly readable'
  );
  assert.equal(
    publicConfigs.app_logo,
    expectedObjectKeys.appLogo,
    '[public-configs] app_logo should persist objectKey'
  );
  assert.equal(
    publicConfigs.app_favicon,
    expectedObjectKeys.appFavicon,
    '[public-configs] app_favicon should persist objectKey'
  );
  assert.equal(
    publicConfigs.app_og_image,
    expectedObjectKeys.appOgImage,
    '[public-configs] app_og_image should persist objectKey'
  );
  assert.deepEqual(
    buildExpectedPublicAssetUrls({
      storagePublicBaseUrl: publicConfigs.storage_public_base_url,
      objectKeys: {
        appLogo: publicConfigs.app_logo,
        appFavicon: publicConfigs.app_favicon,
        appOgImage: publicConfigs.app_og_image,
      },
    }),
    expectedAssetUrls,
    '[public-configs] runtime derived public asset URLs should remain stable within the single local topology session'
  );
}

export async function main() {
  const fallbackBaseUrl = resolveConfiguredPreviewBaseUrl(
    process.env.CF_LOCAL_SMOKE_URL
  );
  const databaseUrl = await resolveCloudflareLocalDatabaseUrl({
    processEnv: process.env,
  });
  const authSecret = resolveAuthSecret();
  const smokeLocales = resolveSmokeLocales();

  assert(databaseUrl, 'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required');
  assert.ok(
    smokeLocales.length > 0,
    'CF admin settings smoke requires at least one locale'
  );

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '');
  const baseline = await captureConfigBaseline(databaseUrl, SMOKE_CONFIG_NAMES);
  const seedSettings = createSeedSettings(timestamp);
  const smokeUser = {
    email: createTempEmail('storage-user'),
    userName: `CF Admin Settings ${timestamp}`,
  };

  let topology = null;
  let baseUrl = '';
  let expectedAssetUrls = null;
  let uploadedKeys = null;
  let smokeUserId = null;
  let signedInCookieHeader = '';

  try {
    await runPhaseSequence({
      phases: [
        {
          label: 'seed-brand-settings',
          action: async () => {
            await writeConfigsNormalized(databaseUrl, seedSettings);
          },
        },
        {
          label: 'seed-upload-session',
          action: async () => {
            const seededSession = await seedSmokeUserSession(
              databaseUrl,
              smokeUser
            );
            smokeUserId = seededSession.userId;
            signedInCookieHeader = buildSignedInSessionCookieHeader(
              seededSession.sessionToken
            );
          },
        },
        {
          label: 'start-preview-topology',
          action: async () => {
            const started = await startPreviewTopology({
              databaseUrl,
              routerBaseUrl: fallbackBaseUrl,
              authSecret,
            });
            topology = started.topology;
            baseUrl = started.baseUrl;
          },
        },
        {
          label: 'upload-brand-assets',
          action: async () => {
            assert.ok(
              baseUrl,
              'cloudflare baseUrl should be ready before uploads'
            );

            const uploads = await uploadBrandAssetsViaSession({
              baseUrl,
              cookieHeader: signedInCookieHeader,
              storagePublicBaseUrl: seedSettings.storage_public_base_url,
            });

            uploadedKeys = {
              appLogo: uploads.appLogo.key,
              appFavicon: uploads.appFavicon.key,
              appOgImage: uploads.appOgImage.key,
            };
            expectedAssetUrls = buildExpectedPublicAssetUrls({
              storagePublicBaseUrl: seedSettings.storage_public_base_url,
              objectKeys: uploadedKeys,
            });
          },
        },
        {
          label: 'public-brand-config-projection',
          action: async () => {
            assert(uploadedKeys, 'uploaded brand asset keys are required');
            assert.ok(
              baseUrl,
              'cloudflare baseUrl should be ready before public config fetch'
            );

            await writeConfigsNormalized(databaseUrl, {
              app_logo: uploadedKeys.appLogo,
              app_favicon: uploadedKeys.appFavicon,
              app_og_image: uploadedKeys.appOgImage,
            });

            const publicConfigs = await fetchPublicConfigs(baseUrl);
            assertPublicBrandConfigProjection({
              publicConfigs,
              expectedAppName: seedSettings.app_name,
              expectedStoragePublicBaseUrl:
                seedSettings.storage_public_base_url,
              expectedObjectKeys: uploadedKeys,
              expectedAssetUrls,
            });
          },
        },
        {
          label: 'upload-denied-without-storage-public-base-url',
          action: async () => {
            assert.ok(
              baseUrl,
              'cloudflare baseUrl should be ready before denied upload check'
            );

            await writeConfigsNormalized(databaseUrl, {
              storage_public_base_url: '',
            });

            await assertStorageUploadDenied({
              baseUrl,
              cookieHeader: signedInCookieHeader,
            });
          },
        },
      ],
      cleanup: async () => {
        await topology?.stop();
        topology = null;
        await restoreConfigBaseline(databaseUrl, baseline);
        await deleteSmokeUser(databaseUrl, smokeUserId);
      },
    });

    console.log('Cloudflare admin settings smoke passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cloudflare admin settings smoke failed: ${message}`);

    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      console.error(recentLogs);
    }

    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
