import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
  resolveSiteConfigPath,
} from './lib/site-config.mjs';
import {
  resolveSiteDeploySettingsPath,
  validateSiteDeploySettings,
} from './lib/site-deploy-settings.mjs';
import {
  readCurrentSitePricing,
  resolveSitePricingPath,
} from './lib/site-pricing.mjs';

const ROOT_DIR = process.cwd();
const COMMON_ENTITLEMENT_KEYS = new Set([
  'low_res_download',
  'max_upload_mb',
  'retention_days',
]);
const ISSUE_LEVEL = {
  BLOCKER: 'blocker',
  WARNING: 'warning',
};

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join('/');
}

function source(kind, sourcePath, key) {
  return {
    kind,
    path: sourcePath ? relativePath(sourcePath) : undefined,
    key,
  };
}

function issue(level, code, message, sources = []) {
  return { level, code, message, sources };
}

function section(status, value, sources, issues = []) {
  return { status, value, sources, issues };
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCheckoutEnabled(item) {
  return item.checkout_enabled !== false && item.amount > 0;
}

function readTextIfExists(filePath) {
  if (!existsSync(filePath)) {
    return '';
  }

  return readFileSync(filePath, 'utf8');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectPricingItems(sitePricing) {
  return sitePricing?.pricing?.items ?? [];
}

function isPropertyName(node, name) {
  return (
    (ts.isIdentifier(node) || ts.isStringLiteral(node)) && node.text === name
  );
}

function isStringLike(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function hasSettingDefinition(sourcePath, settingName) {
  const sourceText = readTextIfExists(sourcePath);
  if (!sourceText) {
    return false;
  }

  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let found = false;

  function visit(node) {
    if (found) {
      return;
    }

    if (
      ts.isPropertyAssignment(node) &&
      isPropertyName(node.name, 'name') &&
      isStringLike(node.initializer) &&
      node.initializer.text === settingName
    ) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function collectStringLiterals(sourcePath) {
  const sourceText = readTextIfExists(sourcePath);
  if (!sourceText) {
    return new Set();
  }

  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const values = new Set();

  function visit(node) {
    if (isStringLike(node)) {
      values.add(node.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

function envContractStatus(sourcePath, keys, match = 'all') {
  const values = collectStringLiterals(sourcePath);
  const hasKey =
    match === 'any'
      ? keys.some((key) => values.has(key))
      : keys.every((key) => values.has(key));

  return hasKey ? 'runtime_owned' : 'missing';
}

function collectEntitlementKeys(items) {
  const keys = new Set();
  for (const item of items) {
    for (const key of Object.keys(item.entitlements ?? {})) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

function classifyEntitlementKey(key, siteKey) {
  if (COMMON_ENTITLEMENT_KEYS.has(key)) {
    return 'common_known';
  }

  if (key.startsWith(`product.${siteKey}.`)) {
    return 'product_owned';
  }

  return 'raw_unknown';
}

function auditSite(site, sitePath, siteIssues = []) {
  const checks = [
    ['key', site.key],
    ['brand.appName', site.brand?.appName],
    ['brand.appUrl', site.brand?.appUrl],
    ['brand.supportEmail', site.brand?.supportEmail],
    ['brand.logo', site.brand?.logo],
    ['brand.favicon', site.brand?.favicon],
    ['brand.previewImage', site.brand?.previewImage],
    ['capabilities', site.capabilities],
  ];
  const issues = [
    ...siteIssues,
    ...checks
      .filter(([, value]) => {
        if (typeof value === 'object' && value !== null) {
          return Object.keys(value).length === 0;
        }
        return !hasText(value);
      })
      .map(([key]) =>
        issue(
          ISSUE_LEVEL.BLOCKER,
          'missing_site_field',
          `Missing site ${key}`,
          [source('site_config', sitePath, key)]
        )
      ),
  ];

  return section(
    issues.length === 0 ? 'resolved' : 'partial',
    {
      key: site.key,
      appName: site.brand?.appName,
      appUrl: site.brand?.appUrl,
      supportEmail: site.brand?.supportEmail,
      logo: site.brand?.logo,
      favicon: site.brand?.favicon,
      previewImage: site.brand?.previewImage,
      capabilities: site.capabilities,
    },
    [source('site_config', sitePath)],
    issues
  );
}

function readLooseSiteConfig(sitePath, siteKey) {
  const fallback = { key: siteKey, brand: {}, capabilities: {} };
  const sourceText = readTextIfExists(sitePath);
  if (!sourceText) {
    return fallback;
  }

  try {
    const site = JSON.parse(sourceText);
    if (!isPlainObject(site)) {
      return fallback;
    }

    return {
      ...site,
      key: hasText(site.key) ? site.key : siteKey,
      brand: isPlainObject(site.brand) ? site.brand : {},
      capabilities: isPlainObject(site.capabilities) ? site.capabilities : {},
    };
  } catch {
    return fallback;
  }
}

function readSiteForReport({ rootDir, siteKey, sitePath }) {
  try {
    return {
      site: readCurrentSiteConfig({ rootDir, siteKey }),
      issues: [],
    };
  } catch (error) {
    return {
      site: readLooseSiteConfig(sitePath, siteKey),
      issues: [
        issue(
          ISSUE_LEVEL.BLOCKER,
          'invalid_site_config',
          `Site config could not be read or validated: ${getErrorMessage(error)}`,
          [source('site_config', sitePath)]
        ),
      ],
    };
  }
}

function readPricingForReport({ rootDir, site, siteKey, pricingPath }) {
  try {
    return {
      sitePricing: readCurrentSitePricing({
        rootDir,
        site,
        siteKey,
      }),
      issues: [],
    };
  } catch (error) {
    return {
      sitePricing: null,
      issues: [
        issue(
          ISSUE_LEVEL.BLOCKER,
          'invalid_pricing_file',
          `Pricing file could not be read or validated: ${getErrorMessage(error)}`,
          [source('pricing', pricingPath)]
        ),
      ],
    };
  }
}

function readDeploySettingsForReport({ deploySettingsPath }) {
  try {
    const deploySettings = JSON.parse(readFileSync(deploySettingsPath, 'utf8'));
    validateSiteDeploySettings(deploySettings);

    return {
      deploySettings,
      issues: [],
    };
  } catch (error) {
    return {
      deploySettings: null,
      issues: [
        issue(
          ISSUE_LEVEL.BLOCKER,
          'invalid_deploy_settings',
          `Deploy settings could not be read or validated: ${getErrorMessage(error)}`,
          [source('deploy_settings', deploySettingsPath)]
        ),
      ],
    };
  }
}

function resolveMappingOwnership({
  item,
  paymentCapability,
  settingsSourcePath,
}) {
  if (hasText(item.payment_product_id)) {
    return {
      status: 'resolved',
      owner: 'pricing',
      source: source('pricing', null, `${item.product_id}.payment_product_id`),
    };
  }

  const hasCurrencyMapping = (item.currencies ?? []).some((currency) =>
    hasText(currency.payment_product_id)
  );
  if (hasCurrencyMapping) {
    return {
      status: 'resolved',
      owner: 'pricing',
      source: source('pricing', null, `${item.product_id}.currencies`),
    };
  }

  if (
    paymentCapability === 'creem' &&
    hasSettingDefinition(settingsSourcePath, 'creem_product_ids')
  ) {
    return {
      status: 'runtime_owned',
      owner: 'admin_setting',
      source: source(
        'settings_definition',
        settingsSourcePath,
        'creem_product_ids'
      ),
    };
  }

  return {
    status: 'missing',
    owner: 'unknown',
    source: source('derived', null, item.product_id),
  };
}

function auditCommercial({
  site,
  sitePricing,
  sitePath,
  pricingPath,
  pricingIssues,
  settingsSourcePath,
}) {
  if (!sitePricing) {
    const issues = pricingIssues.length
      ? pricingIssues
      : site.capabilities?.payment && site.capabilities.payment !== 'none'
        ? [
            issue(
              ISSUE_LEVEL.BLOCKER,
              'missing_pricing_file',
              `Missing pricing file for payment-enabled site ${site.key}`,
              [source('pricing', pricingPath)]
            ),
          ]
        : [];

    return section(
      issues.length === 0 ? 'not_applicable' : 'missing',
      {
        billing: site.capabilities?.payment ?? 'none',
        pricingFile: pricingIssues.length
          ? 'invalid'
          : existsSync(pricingPath)
            ? 'resolved'
            : 'missing',
        planCount: 0,
        paidCheckoutPlanCount: 0,
        plans: [],
      },
      [source('pricing', pricingPath)],
      issues
    );
  }

  const items = collectPricingItems(sitePricing);
  const planIssues = [];
  const plans = items.map((item) => {
    const mappingOwnership = isCheckoutEnabled(item)
      ? resolveMappingOwnership({
          item,
          paymentCapability: site.capabilities?.payment,
          settingsSourcePath,
        })
      : {
          status: 'not_applicable',
          owner: 'none',
          source: source('derived', null, item.product_id),
        };

    if (isCheckoutEnabled(item) && mappingOwnership.status === 'missing') {
      planIssues.push(
        issue(
          ISSUE_LEVEL.BLOCKER,
          'missing_payment_product_mapping',
          `Paid checkout plan ${item.product_id} has no payment product mapping path`,
          [source('pricing', pricingPath, item.product_id)]
        )
      );
    }

    return {
      productId: item.product_id,
      title: item.title,
      checkoutEnabled: isCheckoutEnabled(item),
      interval: item.interval,
      amount: item.amount,
      currency: item.currency,
      paymentProductMapping: {
        status: mappingOwnership.status,
        owner: mappingOwnership.owner,
        sources: [mappingOwnership.source],
      },
    };
  });

  return section(
    planIssues.length === 0 ? 'resolved' : 'partial',
    {
      billing: site.capabilities?.payment ?? 'none',
      pricingFile: 'resolved',
      planCount: items.length,
      paidCheckoutPlanCount: items.filter(isCheckoutEnabled).length,
      plans,
    },
    [
      source('pricing', pricingPath),
      source('site_config', sitePath, 'capabilities.payment'),
    ],
    planIssues
  );
}

function auditEntitlementKeys({ siteKey, items, pricingPath }) {
  const entries = collectEntitlementKeys(items).map((key) => ({
    key,
    classification: classifyEntitlementKey(key, siteKey),
  }));
  const issues = entries
    .filter((entry) => entry.classification === 'raw_unknown')
    .map((entry) =>
      issue(
        ISSUE_LEVEL.WARNING,
        'raw_entitlement_key',
        `Raw entitlement key ${entry.key} should migrate to common or product-owned naming`,
        [source('pricing', pricingPath, `entitlements.${entry.key}`)]
      )
    );

  return section(
    issues.length === 0 ? 'resolved' : 'partial',
    {
      keys: entries,
      allowedProductOwnedPrefix: `product.${siteKey}.`,
    },
    [source('pricing', pricingPath)],
    issues
  );
}

function settingStatus(sourcePath, settingName) {
  return hasSettingDefinition(sourcePath, settingName)
    ? 'runtime_owned'
    : 'missing';
}

function deployRequirementStatus(deploySettings, group, key) {
  if (!deploySettings) {
    return 'missing';
  }

  return deploySettings?.bindingRequirements?.[group]?.[key]
    ? 'runtime_owned'
    : 'not_applicable';
}

function envBackedDeployRequirementStatus({
  deploySettings,
  group,
  key,
  envContractPath,
  envKeys,
  match,
}) {
  const deployStatus = deployRequirementStatus(deploySettings, group, key);
  if (deployStatus !== 'runtime_owned') {
    return deployStatus;
  }

  return envContractStatus(envContractPath, envKeys, match);
}

function auditRuntimeOwnership({
  site,
  deploySettings,
  deploySettingsPath,
  deployIssues,
  paymentSettingsPath,
  envContractPath,
}) {
  const paymentCapability = site.capabilities?.payment ?? 'none';
  const entries = [
    {
      name: 'payment provider product mapping',
      expectedKey:
        paymentCapability === 'creem'
          ? 'creem_product_ids'
          : `${paymentCapability}_product_mapping`,
      owner: paymentCapability === 'creem' ? 'admin_setting' : 'runtime',
      status:
        paymentCapability === 'creem'
          ? settingStatus(paymentSettingsPath, 'creem_product_ids')
          : 'not_applicable',
      sources: [
        source('settings_definition', paymentSettingsPath, 'creem_product_ids'),
      ],
    },
    {
      name: 'payment provider secrets',
      expectedKey:
        paymentCapability === 'creem'
          ? 'CREEM_API_KEY, CREEM_SIGNING_SECRET'
          : `${String(paymentCapability).toUpperCase()} provider secrets`,
      owner: 'cloudflare_secret',
      status:
        paymentCapability === 'creem'
          ? envContractStatus(envContractPath, [
              'CREEM_API_KEY',
              'CREEM_SIGNING_SECRET',
            ])
          : 'not_applicable',
      sources: [
        source('runtime_env', envContractPath, 'CREEM_API_KEY'),
        source('runtime_env', envContractPath, 'CREEM_SIGNING_SECRET'),
      ],
    },
    {
      name: 'auth shared secret',
      expectedKey: 'BETTER_AUTH_SECRET or AUTH_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'authSharedSecret',
        envContractPath,
        envKeys: ['BETTER_AUTH_SECRET', 'AUTH_SECRET'],
        match: 'any',
      }),
      sources: [
        source(
          'deploy_settings',
          deploySettingsPath,
          'secrets.authSharedSecret'
        ),
        source('runtime_env', envContractPath, 'BETTER_AUTH_SECRET'),
        source('runtime_env', envContractPath, 'AUTH_SECRET'),
      ],
    },
    {
      name: 'Google OAuth secrets',
      expectedKey: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'googleOauth',
        envContractPath,
        envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      }),
      sources: [
        source('deploy_settings', deploySettingsPath, 'secrets.googleOauth'),
        source('runtime_env', envContractPath, 'GOOGLE_CLIENT_ID'),
        source('runtime_env', envContractPath, 'GOOGLE_CLIENT_SECRET'),
      ],
    },
    {
      name: 'GitHub OAuth secrets',
      expectedKey: 'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'githubOauth',
        envContractPath,
        envKeys: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
      }),
      sources: [
        source('deploy_settings', deploySettingsPath, 'secrets.githubOauth'),
        source('runtime_env', envContractPath, 'GITHUB_CLIENT_ID'),
        source('runtime_env', envContractPath, 'GITHUB_CLIENT_SECRET'),
      ],
    },
    {
      name: 'storage public URL',
      expectedKey: 'STORAGE_PUBLIC_BASE_URL',
      owner: 'cloudflare_var',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'vars',
        key: 'storagePublicBaseUrl',
        envContractPath,
        envKeys: ['STORAGE_PUBLIC_BASE_URL'],
      }),
      sources: [
        source(
          'deploy_settings',
          deploySettingsPath,
          'vars.storagePublicBaseUrl'
        ),
        source('runtime_env', envContractPath, 'STORAGE_PUBLIC_BASE_URL'),
      ],
    },
    {
      name: 'AI Remover cleanup secret',
      expectedKey: 'REMOVER_CLEANUP_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'removerCleanup',
        envContractPath,
        envKeys: ['REMOVER_CLEANUP_SECRET'],
      }),
      sources: [
        source('deploy_settings', deploySettingsPath, 'secrets.removerCleanup'),
        source('runtime_env', envContractPath, 'REMOVER_CLEANUP_SECRET'),
      ],
    },
  ];
  const issues = [
    ...deployIssues,
    ...entries
      .filter((entry) => entry.status === 'missing')
      .map((entry) =>
        issue(
          ISSUE_LEVEL.WARNING,
          'missing_runtime_owner',
          `Runtime-owned field ${entry.name} has no configured owner`,
          entry.sources
        )
      ),
  ];

  return section(
    issues.length === 0 ? 'runtime_owned' : 'partial',
    { fields: entries },
    [
      source('deploy_settings', deploySettingsPath),
      source('settings_definition', paymentSettingsPath),
      source('runtime_env', envContractPath),
    ],
    issues
  );
}

function collectLaunch(report) {
  const issues = [
    report.site,
    report.commercial,
    report.entitlementKeys,
    report.runtimeOwnership,
  ].flatMap((item) => item.issues);

  return {
    blockers: issues.filter((item) => item.level === ISSUE_LEVEL.BLOCKER),
    warnings: issues.filter((item) => item.level === ISSUE_LEVEL.WARNING),
    recommendedCommands: [
      'SITE=ai-remover node scripts/check-saas-product-contract.mjs',
      'pnpm test src/config/product-modules/index.test.ts src/config/product-modules/doc-links.test.ts',
    ],
  };
}

function buildAuditReport(siteKey) {
  const sitePath = resolveSiteConfigPath({ rootDir: ROOT_DIR, siteKey });
  const pricingPath = resolveSitePricingPath({ rootDir: ROOT_DIR, siteKey });
  const deploySettingsPath = resolveSiteDeploySettingsPath({
    rootDir: ROOT_DIR,
    siteKey,
  });
  const paymentSettingsPath = path.resolve(
    ROOT_DIR,
    'src/domains/settings/definitions/payment.ts'
  );
  const envContractPath = path.resolve(ROOT_DIR, 'src/config/env-contract.ts');

  const { site, issues: siteIssues } = readSiteForReport({
    rootDir: ROOT_DIR,
    siteKey,
    sitePath,
  });
  const { sitePricing, issues: pricingIssues } = readPricingForReport({
    rootDir: ROOT_DIR,
    site,
    siteKey,
    pricingPath,
  });
  const { deploySettings, issues: deployIssues } = readDeploySettingsForReport({
    deploySettingsPath,
  });
  const pricingItems = collectPricingItems(sitePricing);
  const report = {
    site: auditSite(site, sitePath, siteIssues),
    commercial: auditCommercial({
      site,
      sitePricing,
      sitePath,
      pricingPath,
      pricingIssues,
      settingsSourcePath: paymentSettingsPath,
    }),
    entitlementKeys: auditEntitlementKeys({
      siteKey,
      items: pricingItems,
      pricingPath,
    }),
    runtimeOwnership: auditRuntimeOwnership({
      site,
      deploySettings,
      deploySettingsPath,
      deployIssues,
      paymentSettingsPath,
      envContractPath,
    }),
  };

  return {
    ...report,
    launch: collectLaunch(report),
  };
}

function formatSourceRef(item) {
  const parts = [item.kind];
  if (item.path) {
    parts.push(item.path);
  }
  if (item.key) {
    parts.push(item.key);
  }
  return parts.join(':');
}

function formatIssueList(items) {
  if (items.length === 0) {
    return ['  none'];
  }

  return items.flatMap((item) => {
    const lines = [`  ${item.level}  ${item.message}`];
    for (const itemSource of item.sources) {
      lines.push(`    source  ${formatSourceRef(itemSource)}`);
    }
    return lines;
  });
}

function formatSectionSources(label, sources) {
  const refs = sources.map(formatSourceRef).filter(Boolean).join(', ');
  return `  ${label}: ${refs}`;
}

function formatAuditReport(report) {
  const siteValue = report.site.value;
  const commercialValue = report.commercial.value;
  const entitlementKeys = report.entitlementKeys.value.keys;
  const runtimeFields = report.runtimeOwnership.value.fields;
  const lines = [
    'SaaS Contract Audit',
    '',
    `Site: ${siteValue.key}`,
    `Site section: ${report.site.status}`,
    `Billing: ${commercialValue.billing}`,
    `Pricing file: ${commercialValue.pricingFile}`,
    `Plans: ${commercialValue.planCount ?? 0} ${report.commercial.status}`,
    '',
    'Entitlement keys:',
  ];

  for (const entry of entitlementKeys) {
    const label =
      entry.classification === 'raw_unknown' ? 'warning' : 'ok     ';
    const suffix =
      entry.classification === 'raw_unknown'
        ? `raw key: ${entry.key}`
        : `${entry.key} (${entry.classification})`;
    lines.push(`  ${label}  ${suffix}`);
  }

  lines.push('', 'Runtime-owned fields:');
  for (const field of runtimeFields) {
    lines.push(
      `  ${field.name}: ${field.status} (${field.owner}, ${field.expectedKey})`
    );
  }

  lines.push('', 'Sources:');
  lines.push(formatSectionSources('site', report.site.sources));
  lines.push(formatSectionSources('commercial', report.commercial.sources));
  lines.push(
    formatSectionSources('entitlement keys', report.entitlementKeys.sources)
  );
  lines.push(
    formatSectionSources('runtime ownership', report.runtimeOwnership.sources)
  );

  lines.push(
    '',
    'Launch blockers:',
    ...formatIssueList(report.launch.blockers)
  );
  lines.push('', 'Warnings:', ...formatIssueList(report.launch.warnings));
  lines.push('', 'Recommended commands:');
  for (const command of report.launch.recommendedCommands) {
    lines.push(`  ${command}`);
  }

  return lines.join('\n');
}

function main() {
  const siteKey = resolveRequiredSiteKey(process.env);
  if (siteKey !== 'ai-remover') {
    throw new Error(
      `Contract audit PR 1 only supports SITE=ai-remover; received SITE=${siteKey}`
    );
  }

  const report = buildAuditReport(siteKey);
  process.stdout.write(`${formatAuditReport(report)}\n`);

  if (report.launch.blockers.length > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `SaaS contract audit failed: ${getErrorMessage(error)}\n`
  );
  process.exit(1);
}
