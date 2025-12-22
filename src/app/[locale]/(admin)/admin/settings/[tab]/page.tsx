import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { parseFormData } from '@/shared/lib/action/form';
import {
  requireActionPermissions,
  requireActionUser,
} from '@/shared/lib/action/guard';
import { actionErr, actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { generalSocialLinksSchema } from '@/shared/lib/general-ui.schema';
import { PUBLIC_CONFIGS_CACHE_TAG } from '@/shared/lib/public-configs-cache';
import { getConfigsSafe, saveConfigs } from '@/shared/models/config';
import { requireAllPermissions } from '@/shared/services/rbac_guard';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/shared/services/settings';
import {
  parseCreemProductIdsMappingConfig,
  parseStripePaymentMethodsConfig,
} from '@/shared/services/settings/validators/payment';
import type { Crumb } from '@/shared/types/blocks/common';
import type { FormField, Form as FormType } from '@/shared/types/blocks/form';

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

      const recordSchema = z.record(z.string(), z.string());
      const values = parseFormData(data, recordSchema);

      let normalizedSocialLinks: string | undefined;
      const socialLinks = values.general_social_links;
      if (typeof socialLinks === 'string') {
        const trimmed = socialLinks.trim();
        if (!trimmed) {
          normalizedSocialLinks = '';
        } else {
          try {
            const parsed = JSON.parse(trimmed) as unknown;
            const result = generalSocialLinksSchema.safeParse(parsed);
            if (!result.success) {
              const issues = result.error.issues
                .slice(0, 3)
                .map((issue) => {
                  const path = issue.path.length
                    ? issue.path.join('.')
                    : 'root';
                  return `${path}: ${issue.message}`;
                })
                .join('; ');
              return actionErr(
                `Invalid Social Links JSON. ${issues || ''} Expected an array. When enabled=true, icon and url are required.`.trim()
              );
            }
            normalizedSocialLinks = JSON.stringify(result.data);
          } catch {
            return actionErr('Invalid Social Links JSON. Must be valid JSON.');
          }
        }
      }

      let normalizedStripePaymentMethods: string | undefined;
      const stripePaymentMethods = values.stripe_payment_methods;
      if (typeof stripePaymentMethods === 'string') {
        const result = parseStripePaymentMethodsConfig(stripePaymentMethods);
        if (!result.ok) {
          return actionErr(
            `Invalid Stripe Payment Methods. ${result.error}. Expected a JSON array, e.g. ["card","alipay"].`
          );
        }
        normalizedStripePaymentMethods = result.normalized;
      }

      let normalizedCreemProductIds: string | undefined;
      const creemProductIds = values.creem_product_ids;
      if (typeof creemProductIds === 'string') {
        const trimmed = creemProductIds.trim();
        if (!trimmed) {
          normalizedCreemProductIds = '';
        } else {
          const result = parseCreemProductIdsMappingConfig(creemProductIds);
          if (!result.ok) {
            return actionErr(
              `Invalid Creem Product IDs Mapping. ${result.error}. Expected a JSON object, e.g. {"starter":"prod_xxx"}.`
            );
          }
          normalizedCreemProductIds = result.normalized;
        }
      }

      for (const [name, value] of Object.entries(values)) {
        if (
          name === 'general_social_links' &&
          normalizedSocialLinks !== undefined
        ) {
          configs[name] = normalizedSocialLinks;
          continue;
        }

        if (
          name === 'stripe_payment_methods' &&
          normalizedStripePaymentMethods !== undefined
        ) {
          configs[name] = normalizedStripePaymentMethods;
          continue;
        }

        if (
          name === 'creem_product_ids' &&
          normalizedCreemProductIds !== undefined
        ) {
          configs[name] = normalizedCreemProductIds;
          continue;
        }

        configs[name] = value;
      }

      await saveConfigs(configs);
      revalidateTag(PUBLIC_CONFIGS_CACHE_TAG, 'max');

      return actionOk('Settings updated');
    });
  };

  const forms: FormType[] = [];

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
          <div className="border-destructive bg-destructive/10 text-destructive mb-4 rounded-md border p-3 text-sm">
            <p className="font-semibold">{loadErrorTitle}</p>
            <p className="text-destructive/80 mt-1 text-xs">{loadErrorDesc}</p>
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
