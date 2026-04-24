import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits.ts';
import { resolveRequiredSiteKey } from './site-config.mjs';
import { resolveSiteDeployContract } from './site-deploy-contract.mjs';

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
const SERVER_RUNTIME_WORKER_KEYS = Object.freeze([
  'public-web',
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
]);

function formatAllowedWorkerKeys() {
  return [
    ...Object.keys(CLOUDFLARE_WORKER_SCOPES),
    ...CLOUDFLARE_ALL_WORKER_SCOPE,
  ].join(', ');
}

function pushRequirement(list, requirement) {
  list.push(requirement);
}

function buildRequirementSignature(workerKey, requirement) {
  const names = requirement.names ?? [requirement.name];
  return `${workerKey}:${names.join('|')}`;
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

function buildDeploySecretRequirementMap(contract) {
  const requirements = createRequirementMap();
  const { secrets, vars } = contract.bindingRequirements;

  if (vars.storagePublicBaseUrl) {
    for (const worker of ['router', ...SERVER_RUNTIME_WORKER_KEYS]) {
      pushRequirement(requirements.get(worker), {
        kind: 'runtime-var',
        worker,
        name: 'STORAGE_PUBLIC_BASE_URL',
        requirement: 'storagePublicBaseUrl',
        capability: 'Cloudflare R2 public asset base URL',
      });
    }
  }

  if (secrets.authSharedSecret) {
    for (const worker of SERVER_RUNTIME_WORKER_KEYS) {
      pushRequirement(requirements.get(worker), {
        kind: 'runtime-secret',
        worker,
        names: ['BETTER_AUTH_SECRET', 'AUTH_SECRET'],
        outputNames: ['BETTER_AUTH_SECRET', 'AUTH_SECRET'],
        requirement: 'authSharedSecret',
        capability: 'Next server runtime shared auth secret',
      });
    }
  }

  if (secrets.googleOauth) {
    for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
      pushRequirement(requirements.get('auth'), {
        kind: 'runtime-secret',
        worker: 'auth',
        name,
        requirement: 'googleOauth',
        capability: 'Google auth provider',
      });
    }
  }

  if (secrets.githubOauth) {
    for (const name of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']) {
      pushRequirement(requirements.get('auth'), {
        kind: 'runtime-secret',
        worker: 'auth',
        name,
        requirement: 'githubOauth',
        capability: 'GitHub auth provider',
      });
    }
  }

  if (secrets.stripe) {
    for (const worker of ['payment', 'member']) {
      for (const name of [
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_SIGNING_SECRET',
      ]) {
        pushRequirement(requirements.get(worker), {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'stripe',
          capability: 'Stripe payment provider',
        });
      }
    }
  }

  if (secrets.creem) {
    for (const worker of ['payment', 'member']) {
      for (const name of ['CREEM_API_KEY', 'CREEM_SIGNING_SECRET']) {
        pushRequirement(requirements.get(worker), {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'creem',
          capability: 'Creem payment provider',
        });
      }
    }
  }

  if (secrets.paypal) {
    for (const worker of ['payment', 'member']) {
      for (const name of [
        'PAYPAL_CLIENT_ID',
        'PAYPAL_CLIENT_SECRET',
        'PAYPAL_WEBHOOK_ID',
      ]) {
        pushRequirement(requirements.get(worker), {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'paypal',
          capability: 'PayPal payment provider',
        });
      }
    }
  }

  if (secrets.openrouter) {
    pushRequirement(requirements.get('chat'), {
      kind: 'runtime-secret',
      worker: 'chat',
      name: 'OPENROUTER_API_KEY',
      requirement: 'openrouter',
      capability: 'Chat AI runtime',
    });
  }

  return requirements;
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

export function readCloudflareDeployRequirements({
  processEnv = process.env,
  rootDir = process.cwd(),
} = {}) {
  return resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(processEnv),
  }).bindingRequirements;
}

export function getRequiredRuntimeBindingsByWorker(
  bindingRequirements = readCloudflareDeployRequirements()
) {
  return buildDeploySecretRequirementMap({
    bindingRequirements,
  });
}

export function collectRequiredRuntimeBindings(
  workerKeys,
  bindingRequirements = readCloudflareDeployRequirements()
) {
  const normalizedWorkerKeys = normalizeCloudflareWorkerKeys(workerKeys);
  const requirementsByWorker =
    getRequiredRuntimeBindingsByWorker(bindingRequirements);
  const collected = [];
  const seen = new Set();

  for (const workerKey of normalizedWorkerKeys) {
    for (const requirement of requirementsByWorker.get(workerKey) || []) {
      const signature = buildRequirementSignature(workerKey, requirement);
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
  bindingRequirements = readCloudflareDeployRequirements()
) {
  return collectRequiredRuntimeBindings(workerKeys, bindingRequirements)
    .filter((requirement) => requirement.kind === 'runtime-secret')
    .flatMap(
      (requirement) =>
        requirement.outputNames ?? requirement.names ?? [requirement.name]
    );
}
