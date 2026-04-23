import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits.ts';
import { resolveRequiredSiteKey } from './site-config.mjs';
import { readSiteDeploySettings } from './site-deploy-settings.mjs';

const { CLOUDFLARE_ALL_SERVER_WORKER_TARGETS } = cloudflareWorkerSplits;

export const CLOUDFLARE_STATE_WORKER_SCOPE = Object.freeze(['state']);
export const CLOUDFLARE_APP_WORKER_SCOPE = Object.freeze([
  'router',
  ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
]);
export const CLOUDFLARE_ALL_WORKER_SCOPE = Object.freeze([
  ...CLOUDFLARE_STATE_WORKER_SCOPE,
  ...CLOUDFLARE_APP_WORKER_SCOPE,
]);
export const CLOUDFLARE_WORKER_SCOPES = Object.freeze({
  state: CLOUDFLARE_STATE_WORKER_SCOPE,
  app: CLOUDFLARE_APP_WORKER_SCOPE,
  all: CLOUDFLARE_ALL_WORKER_SCOPE,
});

const ALLOWED_WORKER_KEYS = new Set(CLOUDFLARE_ALL_WORKER_SCOPE);

function formatAllowedWorkerKeys() {
  return [
    ...Object.keys(CLOUDFLARE_WORKER_SCOPES),
    ...CLOUDFLARE_ALL_WORKER_SCOPE,
  ].join(', ');
}

export function normalizeCloudflareWorkerKeys(workerKeys) {
  if (!Array.isArray(workerKeys) || workerKeys.length === 0) {
    throw new Error(
      `Cloudflare worker scope is required. Use --workers=state|app|all|<comma-list>. Allowed values: ${formatAllowedWorkerKeys()}`
    );
  }

  const normalized = [
    ...new Set(
      workerKeys.map((workerKey) => String(workerKey).trim()).filter(Boolean)
    ),
  ];

  if (normalized.length === 0) {
    throw new Error(
      `Cloudflare worker scope is required. Use --workers=state|app|all|<comma-list>. Allowed values: ${formatAllowedWorkerKeys()}`
    );
  }

  for (const workerKey of normalized) {
    if (!ALLOWED_WORKER_KEYS.has(workerKey)) {
      throw new Error(
        `Unknown Cloudflare worker "${workerKey}". Allowed values: ${formatAllowedWorkerKeys()}`
      );
    }
  }

  return normalized;
}

export function resolveCloudflareWorkerKeys(value = 'all') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    throw new Error(
      `Cloudflare worker scope is required. Use --workers=state|app|all|<comma-list>. Allowed values: ${formatAllowedWorkerKeys()}`
    );
  }

  const namedScope = CLOUDFLARE_WORKER_SCOPES[rawValue];
  if (namedScope) {
    return [...namedScope];
  }

  return normalizeCloudflareWorkerKeys(rawValue.split(','));
}

const SERVER_RUNTIME_SECRET_NAMES = Object.freeze([
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
]);

const SERVER_RUNTIME_WORKER_KEYS = Object.freeze([
  'public-web',
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
]);

function isEnabled(value) {
  return value === true;
}

function pushRuntimeRequirement(list, worker, name, capability) {
  list.push({
    kind: 'runtime',
    worker,
    name,
    capability,
  });
}

function pushCapabilityRequirement(list, worker, name, setting, capability) {
  list.push({
    kind: 'capability',
    worker,
    name,
    setting,
    capability,
  });
}

function createRequirementMap() {
  return new Map([
    ['router', []],
    ['auth', []],
    ['payment', []],
    ['member', []],
    ['chat', []],
    ['admin', []],
    ['public-web', []],
    ['state', []],
  ]);
}

export function readCloudflareRuntimeSettings({
  processEnv = process.env,
  rootDir = process.cwd(),
} = {}) {
  return readSiteDeploySettings({
    rootDir,
    siteKey: resolveRequiredSiteKey(processEnv),
  });
}

export function getRequiredRuntimeBindingsByWorker(
  runtimeSettings = readCloudflareRuntimeSettings()
) {
  const requirements = createRequirementMap();

  for (const worker of SERVER_RUNTIME_WORKER_KEYS) {
    for (const secretName of SERVER_RUNTIME_SECRET_NAMES) {
      pushRuntimeRequirement(
        requirements.get(worker),
        worker,
        secretName,
        'Next server runtime auth secret'
      );
    }
  }

  if (isEnabled(runtimeSettings.google_auth_enabled)) {
    pushCapabilityRequirement(
      requirements.get('auth'),
      'auth',
      'GOOGLE_CLIENT_ID',
      'google_auth_enabled',
      'Google auth'
    );
    pushCapabilityRequirement(
      requirements.get('auth'),
      'auth',
      'GOOGLE_CLIENT_SECRET',
      'google_auth_enabled',
      'Google auth'
    );
  }

  if (isEnabled(runtimeSettings.github_auth_enabled)) {
    pushCapabilityRequirement(
      requirements.get('auth'),
      'auth',
      'GITHUB_CLIENT_ID',
      'github_auth_enabled',
      'GitHub auth'
    );
    pushCapabilityRequirement(
      requirements.get('auth'),
      'auth',
      'GITHUB_CLIENT_SECRET',
      'github_auth_enabled',
      'GitHub auth'
    );
  }

  if (isEnabled(runtimeSettings.stripe_enabled)) {
    for (const worker of ['payment', 'member']) {
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'STRIPE_PUBLISHABLE_KEY',
        'stripe_enabled',
        'Stripe payment'
      );
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'STRIPE_SECRET_KEY',
        'stripe_enabled',
        'Stripe payment'
      );
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'STRIPE_SIGNING_SECRET',
        'stripe_enabled',
        'Stripe payment'
      );
    }
  }

  if (isEnabled(runtimeSettings.creem_enabled)) {
    for (const worker of ['payment', 'member']) {
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'CREEM_API_KEY',
        'creem_enabled',
        'Creem payment'
      );
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'CREEM_SIGNING_SECRET',
        'creem_enabled',
        'Creem payment'
      );
    }
  }

  if (isEnabled(runtimeSettings.paypal_enabled)) {
    for (const worker of ['payment', 'member']) {
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'PAYPAL_CLIENT_ID',
        'paypal_enabled',
        'PayPal payment'
      );
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'PAYPAL_CLIENT_SECRET',
        'paypal_enabled',
        'PayPal payment'
      );
      pushCapabilityRequirement(
        requirements.get(worker),
        worker,
        'PAYPAL_WEBHOOK_ID',
        'paypal_enabled',
        'PayPal payment'
      );
    }
  }

  if (isEnabled(runtimeSettings.general_ai_enabled)) {
    pushCapabilityRequirement(
      requirements.get('chat'),
      'chat',
      'OPENROUTER_API_KEY',
      'general_ai_enabled',
      'chat AI runtime'
    );
  }

  return requirements;
}

export function collectRequiredRuntimeBindings(
  workerKeys,
  runtimeSettings = readCloudflareRuntimeSettings()
) {
  const normalizedWorkerKeys = normalizeCloudflareWorkerKeys(workerKeys);
  const requirementsByWorker =
    getRequiredRuntimeBindingsByWorker(runtimeSettings);
  const collected = [];
  const seen = new Set();

  for (const workerKey of normalizedWorkerKeys) {
    for (const requirement of requirementsByWorker.get(workerKey) || []) {
      const signature = `${workerKey}:${requirement.name}`;
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      collected.push(requirement);
    }
  }

  return collected;
}

export function collectRequiredSecretNames(
  workerKeys,
  runtimeSettings = readCloudflareRuntimeSettings()
) {
  return collectRequiredRuntimeBindings(workerKeys, runtimeSettings).map(
    (requirement) => {
      return requirement.name;
    }
  );
}
