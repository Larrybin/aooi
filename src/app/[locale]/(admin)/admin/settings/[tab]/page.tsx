// data: RBAC-gated user + settings schema + configs (unstable_cache tags) + Server Action writes
// cache: no-store (request-bound auth); configs cached via unstable_cache (tag=db-configs, 60s) / (tag=public-configs, 3600s)
// reason: admin settings are user-specific; settings-store owns cache invalidation
import { notFound } from 'next/navigation';
import { requireAllPagePermissions } from '@/app/[locale]/(admin)/_guards/page-access';
import {
  requireActionPermissions,
  requireActionUser,
} from '@/app/access-control/action-guard';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/domains/settings';
import {
  readSettingsSafe,
  saveSettings,
} from '@/domains/settings/application/settings-store';
import { mapSettingsToForms } from '@/domains/settings/settings-form-mapper';
import { normalizeSettingOverrides } from '@/domains/settings/settings-normalizers';
import { mergeRegisteredSettingValues } from '@/domains/settings/settings-submit-merge';
import { isSettingTabName } from '@/domains/settings/tab-names';
import { getSettingsModuleContractRows } from '@/surfaces/admin/settings/module-contract';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';

import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { Badge } from '@/shared/components/ui/badge';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { parseFormData } from '@/shared/lib/action/form';
import { actionErr, actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import type { Crumb } from '@/shared/types/blocks/common';
import { getAvailableSettingTabs } from '@/domains/settings';

const SETTINGS_FORM_VALUES_SCHEMA = z.record(z.string(), z.string());

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
  const availableTabs = await getAvailableSettingTabs();
  if (!availableTabs.includes(settingsTab)) {
    notFound();
  }

  // Check if user has permission to read settings
  await requireAllPagePermissions({
    codes: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const { configs, error: configsError } = await readSettingsSafe();

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
  const handleSubmit = async (data: FormData) => {
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

      const nextConfigs = mergeRegisteredSettingValues({
        initialConfigs: configs,
        values,
        normalizedOverrides: normalizedOverrides.value,
      });

      await saveSettings(nextConfigs);

      return actionOk('Settings updated');
    });
  };

  const forms = mapSettingsToForms({
    tab: settingsTab,
    groups: settingGroups,
    settings,
    configs,
    submitLabel: t('edit.buttons.submit'),
    onSubmit: handleSubmit,
  });

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
                  data-relationship={moduleContract.relationship}
                  data-tier={moduleContract.tier}
                  data-verification={moduleContract.verification}
                >
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-title"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {t('edit.module_contract.tier_label')}
                    </span>
                    <Badge variant="secondary">
                      {t(
                        `edit.module_contract.tier_values.${moduleContract.tier}`
                      )}
                    </Badge>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-verification"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
