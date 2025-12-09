import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requireAllPermissions } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { getConfigsSafe, saveConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/shared/services/settings';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form as FormType, FormField } from '@/shared/types/blocks/form';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string; tab: string }>;
}) {
  const { locale, tab } = await params;
  setRequestLocale(locale);

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

  const tabs = await getSettingTabs(tab ?? 'auth');
  const hasConfigsError = Boolean(configsError);

  const handleSubmit = async (data: FormData, passby: any) => {
    'use server';

    if (hasConfigsError) {
      return {
        status: 'error' as const,
        message:
          'Settings could not be saved because configuration values failed to load. Please try again later.',
      };
    }

    const user = await getUserInfo();

    if (!user) {
      throw new Error('no auth');
    }

    data.forEach((value, name) => {
      configs[name] = value as string;
    });

    await saveConfigs(configs);

    return {
      status: 'success' as const,
      message: 'Settings updated',
    };
  };

  let forms: FormType[] = [];

  settingGroups.forEach((group) => {
    if (group.tab !== tab) {
      return;
    }

    forms.push({
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
    });
  });

  const loadErrorTitle = t('edit.errors.load_failed_title');
  const loadErrorDesc = t('edit.errors.load_failed_desc');

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        {configsError && (
          <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold">{loadErrorTitle}</p>
            <p className="mt-1 text-xs text-destructive/80">
              {loadErrorDesc}
            </p>
          </div>
        )}
        <MainHeader title={t('edit.title')} tabs={tabs} />
        {forms.map((form) => (
          <FormCard
            key={form.title}
            title={form.title}
            description={form.description}
            form={form}
            className="mb-8 md:max-w-xl"
          />
        ))}
      </Main>
    </>
  );
}
