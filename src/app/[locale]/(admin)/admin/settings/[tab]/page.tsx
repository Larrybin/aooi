// data: RBAC-gated user + settings schema + configs (unstable_cache tags) + Server Action writes + revalidateTag()
// cache: no-store (request-bound auth); configs cached via unstable_cache (tag=db-configs, 60s) / (tag=public-configs, 3600s)
// reason: admin settings are user-specific; revalidateTag ensures updates propagate
import { revalidateTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';

import { getSettingsModuleContractRows } from '@/features/admin/settings/module-contract';
import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { Badge } from '@/shared/components/ui/badge';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { parseFormData } from '@/shared/lib/action/form';
import {
  requireActionPermissions,
  requireActionUser,
} from '@/shared/lib/action/guard';
import { actionErr, actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { generalSocialLinksSchema } from '@/shared/lib/general-ui.schema';
import { tryJsonParse } from '@/shared/lib/json';
import { PUBLIC_CONFIGS_CACHE_TAG } from '@/shared/lib/public-configs-cache';
import {
  CONFIGS_CACHE_TAG,
  getConfigsSafe,
  saveConfigs,
} from '@/shared/models/config';
import { requireAllPermissions } from '@/shared/services/rbac_guard';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/shared/services/settings';
import { isSettingTabName } from '@/shared/services/settings/tab-names';
import { normalizeAssetSettingValue } from '@/shared/services/settings/validators/general';
import {
  parseCreemProductIdsMappingConfig,
  parseStripePaymentMethodsConfig,
} from '@/shared/services/settings/validators/payment';
import type { Crumb } from '@/shared/types/blocks/common';
import type { FormField, Form as FormType } from '@/shared/types/blocks/form';

const SETTINGS_FORM_VALUES_SCHEMA = z.record(z.string(), z.string());
const SUPPORT_EMAIL_SCHEMA = z.string().email();

type NormalizedSettingValueResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

type SettingValueNormalizer = (
  value: string
) => NormalizedSettingValueResult;

function normalizeRequiredText(
  value: string,
  fieldLabel: string
): NormalizedSettingValueResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: `Invalid ${fieldLabel}. Must not be empty.`,
    };
  }

  return { ok: true, value: trimmed };
}

function normalizeAppUrl(value: string): NormalizedSettingValueResult {
  const trimmed = normalizeRequiredText(value, 'App URL');
  if (!trimmed.ok) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        ok: false,
        error: `Invalid App URL. Must use http/https (got: ${trimmed.value}).`,
      };
    }

    return { ok: true, value: url.origin };
  } catch (error: unknown) {
    return {
      ok: false,
      error: `Invalid App URL. Must be a valid URL (got: ${trimmed.value}, error: ${String(error)}).`,
    };
  }
}

function normalizeSupportEmail(value: string): NormalizedSettingValueResult {
  const normalized = value.trim().toLowerCase();
  const result = SUPPORT_EMAIL_SCHEMA.safeParse(normalized);

  if (!result.success) {
    return {
      ok: false,
      error: 'Invalid Support Email. Must be a valid email address.',
    };
  }

  return { ok: true, value: normalized };
}

function normalizeAssetValue(
  value: string,
  fieldLabel: string,
  errorLabel: string
): NormalizedSettingValueResult {
  const result = normalizeAssetSettingValue(value, fieldLabel);
  if (!result.ok) {
    return { ok: false, error: `Invalid ${errorLabel}. ${result.error}` };
  }

  return result;
}

function formatSocialLinksIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function normalizeSocialLinks(value: string): NormalizedSettingValueResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }

  const parsedResult = tryJsonParse<unknown>(trimmed);
  if (!parsedResult.ok) {
    return {
      ok: false,
      error: 'Invalid Social Links JSON. Must be valid JSON.',
    };
  }

  const result = generalSocialLinksSchema.safeParse(parsedResult.value);
  if (!result.success) {
    const issues = formatSocialLinksIssues(result.error);
    return {
      ok: false,
      error: `Invalid Social Links JSON. ${issues || ''} Expected an array. When enabled=true, icon and url are required.`.trim(),
    };
  }

  return { ok: true, value: JSON.stringify(result.data) };
}

function normalizeStripePaymentMethods(
  value: string
): NormalizedSettingValueResult {
  const result = parseStripePaymentMethodsConfig(value);
  if (!result.ok) {
    return {
      ok: false,
      error: `Invalid Stripe Payment Methods. ${result.error}. Expected a JSON array, e.g. ["card","alipay"].`,
    };
  }

  return { ok: true, value: result.normalized };
}

function normalizeCreemProductIds(value: string): NormalizedSettingValueResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }

  const result = parseCreemProductIdsMappingConfig(value);
  if (!result.ok) {
    return {
      ok: false,
      error: `Invalid Creem Product IDs Mapping. ${result.error}. Expected a JSON object, e.g. {"starter":"prod_xxx"}.`,
    };
  }

  return { ok: true, value: result.normalized };
}

const SETTING_VALUE_NORMALIZERS: Partial<
  Record<string, SettingValueNormalizer>
> = {
  app_name: (value) => normalizeRequiredText(value, 'App Name'),
  app_url: normalizeAppUrl,
  general_support_email: normalizeSupportEmail,
  app_logo: (value) => normalizeAssetValue(value, 'App Logo', 'App Logo'),
  app_favicon: (value) => normalizeAssetValue(value, 'Favicon', 'Favicon'),
  app_og_image: (value) =>
    normalizeAssetValue(value, 'Preview Image', 'Preview Image'),
  general_social_links: normalizeSocialLinks,
  stripe_payment_methods: normalizeStripePaymentMethods,
  creem_product_ids: normalizeCreemProductIds,
};

function normalizeSettingOverrides(values: Record<string, string>) {
  const overrides: Record<string, string> = {};

  for (const [name, value] of Object.entries(values)) {
    const normalize = SETTING_VALUE_NORMALIZERS[name];
    if (!normalize) {
      continue;
    }

    const result = normalize(value);
    if (!result.ok) {
      return result;
    }

    overrides[name] = result.value;
  }

  return { ok: true, value: overrides } as const;
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string; tab: string }>;
}) {
  const { locale, tab } = await params;
  setRequestLocale(locale);

  if (!isSettingTabName(tab)) {
    notFound();
  }

  const settingsTab = tab;

  // Check if user has permission to read settings
  await requireAllPermissions({
    codes: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const { configs, error: configsError } = await getConfigsSafe();

  const settingGroups = await getSettingGroups();
  const settings = await getSettings();

  const t = await getTranslations('admin.settings');

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.settings'), is_active: true },
  ];

  const tabs = await getSettingTabs(settingsTab);
  const hasConfigsError = Boolean(configsError);
  const moduleContractRows = getSettingsModuleContractRows(settingsTab);

  const handleSubmit = async (data: FormData, _passby: unknown) => {
    'use server';

    return withAction(async () => {
      const user = await requireActionUser();
      await requireActionPermissions(
        user.id,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_WRITE
      );

      if (hasConfigsError) {
        return actionErr(
          'Settings could not be saved because configuration values failed to load. Please try again later.'
        );
      }

      const values = parseFormData(data, SETTINGS_FORM_VALUES_SCHEMA);
      const normalizedOverrides = normalizeSettingOverrides(values);
      if (!normalizedOverrides.ok) {
        return actionErr(normalizedOverrides.error);
      }

      for (const [name, value] of Object.entries(values)) {
        configs[name] = normalizedOverrides.value[name] ?? value;
      }

      await saveConfigs(configs);
      revalidateTag(CONFIGS_CACHE_TAG, 'max');
      revalidateTag(PUBLIC_CONFIGS_CACHE_TAG, 'max');

      return actionOk('Settings updated');
    });
  };

  const forms: FormType[] = settingGroups
    .filter((group) => group.tab === tab)
    .map((group) => ({
      title: group.title,
      description: group.description,
      fields: settings
        .filter((setting) => setting.group === group.name)
        .map((setting) => ({
          name: setting.name,
          title: setting.title,
          type: setting.type as FormField['type'],
          placeholder: setting.placeholder,
          group: setting.group,
          options: setting.options,
          tip: setting.tip,
          value: setting.value,
          attributes: setting.attributes,
          metadata: setting.metadata,
        })),
      passby: {
        provider: group.name,
        tab: group.tab,
      },
      data: configs,
      submit: {
        button: {
          title: t('edit.buttons.submit'),
        },
        handler: handleSubmit,
      },
    }));

  const loadErrorTitle = t('edit.errors.load_failed_title');
  const loadErrorDesc = t('edit.errors.load_failed_desc');

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        {configsError && (
          <div className="border-destructive bg-destructive/10 text-destructive mb-4 rounded-md border p-3 text-sm">
            <p className="font-semibold">{loadErrorTitle}</p>
            <p className="text-destructive/80 mt-1 text-xs">{loadErrorDesc}</p>
          </div>
        )}
        <MainHeader title={t('edit.title')} tabs={tabs} />
        {moduleContractRows.length > 0 ? (
          <div
            className="bg-card mb-6 rounded-lg border p-4"
            data-testid="admin-settings-module-contract"
          >
            <div className="flex flex-col gap-3">
              {moduleContractRows.map((moduleContract) => (
                <div
                  key={`${moduleContract.relationship}-${moduleContract.moduleId}`}
                  className="flex flex-wrap items-center gap-4 rounded-md border p-3"
                  data-testid="admin-settings-module-contract-row"
                  data-module-id={moduleContract.moduleId}
                >
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-title"
                  >
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t('edit.module_contract.title_label')}
                    </span>
                    <span className="text-sm font-medium">
                      {moduleContract.title}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-relationship"
                  >
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t('edit.module_contract.relationship_label')}
                    </span>
                    <Badge variant="secondary">
                      {t(
                        `edit.module_contract.relationship_values.${moduleContract.relationship}`
                      )}
                    </Badge>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-tier"
                  >
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t('edit.module_contract.tier_label')}
                    </span>
                    <Badge variant="secondary">
                      {t(`edit.module_contract.tier_values.${moduleContract.tier}`)}
                    </Badge>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-verification"
                  >
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t('edit.module_contract.verification_label')}
                    </span>
                    <Badge variant="outline">
                      {t(
                        `edit.module_contract.verification_values.${moduleContract.verification}`
                      )}
                    </Badge>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-guide"
                  >
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t('edit.module_contract.guide_label')}
                    </span>
                    <a
                      href={moduleContract.guideHref}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary text-sm underline underline-offset-4"
                      data-testid="admin-settings-module-contract-guide-link"
                    >
                      {t('edit.module_contract.guide_cta')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {forms.map((form) => (
          <div key={form.title} data-testid="admin-settings-form-shell">
            <FormCard
              title={form.title}
              description={form.description}
              form={form}
              className="mb-8 md:max-w-xl"
            />
          </div>
        ))}
      </Main>
    </>
  );
}
