// data: RBAC-gated user + settings schema + configs (unstable_cache tags) + Server Action writes + revalidateTag()
// cache: no-store (request-bound auth); configs cached via unstable_cache (tag=db-configs, 60s) / (tag=public-configs, 3600s)
// reason: admin settings are user-specific; revalidateTag ensures updates propagate
import { revalidateTag } from 'next/cache';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';

import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
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
import { normalizeAssetSettingValue } from '@/shared/services/settings/validators/general';
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

      let normalizedAppName: string | undefined;
      const appName = values.app_name;
      if (typeof appName === 'string') {
        const trimmed = appName.trim();
        if (!trimmed) {
          return actionErr('Invalid App Name. Must not be empty.');
        }
        normalizedAppName = trimmed;
      }

      let normalizedAppUrl: string | undefined;
      const appUrl = values.app_url;
      if (typeof appUrl === 'string') {
        const trimmed = appUrl.trim();
        if (!trimmed) {
          return actionErr('Invalid App URL. Must not be empty.');
        }
        try {
          const url = new URL(trimmed);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return actionErr(
              `Invalid App URL. Must use http/https (got: ${trimmed}).`
            );
          }
          normalizedAppUrl = url.origin;
        } catch (error: unknown) {
          return actionErr(
            `Invalid App URL. Must be a valid URL (got: ${trimmed}, error: ${String(error)}).`
          );
        }
      }

      let normalizedSupportEmail: string | undefined;
      const supportEmail = values.general_support_email;
      if (typeof supportEmail === 'string') {
        const trimmed = supportEmail.trim().toLowerCase();
        const emailSchema = z.string().email();
        const result = emailSchema.safeParse(trimmed);
        if (!result.success) {
          return actionErr(
            'Invalid Support Email. Must be a valid email address.'
          );
        }
        normalizedSupportEmail = trimmed;
      }

      let normalizedAppLogo: string | undefined;
      const appLogo = values.app_logo;
      if (typeof appLogo === 'string') {
        const result = normalizeAssetSettingValue(appLogo, 'App Logo');
        if (!result.ok) {
          return actionErr(`Invalid App Logo. ${result.error}`);
        }
        normalizedAppLogo = result.value;
      }

      let normalizedAppFavicon: string | undefined;
      const appFavicon = values.app_favicon;
      if (typeof appFavicon === 'string') {
        const result = normalizeAssetSettingValue(appFavicon, 'Favicon');
        if (!result.ok) {
          return actionErr(`Invalid Favicon. ${result.error}`);
        }
        normalizedAppFavicon = result.value;
      }

      let normalizedAppOgImage: string | undefined;
      const appOgImage = values.app_og_image;
      if (typeof appOgImage === 'string') {
        const result = normalizeAssetSettingValue(appOgImage, 'Preview Image');
        if (!result.ok) {
          return actionErr(`Invalid Preview Image. ${result.error}`);
        }
        normalizedAppOgImage = result.value;
      }

      let normalizedSocialLinks: string | undefined;
      const socialLinks = values.general_social_links;
      if (typeof socialLinks === 'string') {
        const trimmed = socialLinks.trim();
        if (!trimmed) {
          normalizedSocialLinks = '';
        } else {
          const parsedResult = tryJsonParse<unknown>(trimmed);
          if (!parsedResult.ok) {
            return actionErr('Invalid Social Links JSON. Must be valid JSON.');
          }
          const result = generalSocialLinksSchema.safeParse(parsedResult.value);
          if (!result.success) {
            const issues = result.error.issues
              .slice(0, 3)
              .map((issue) => {
                const path = issue.path.length ? issue.path.join('.') : 'root';
                return `${path}: ${issue.message}`;
              })
              .join('; ');
            return actionErr(
              `Invalid Social Links JSON. ${issues || ''} Expected an array. When enabled=true, icon and url are required.`.trim()
            );
          }
          normalizedSocialLinks = JSON.stringify(result.data);
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
        if (name === 'app_name' && normalizedAppName !== undefined) {
          configs[name] = normalizedAppName;
          continue;
        }

        if (name === 'app_url' && normalizedAppUrl !== undefined) {
          configs[name] = normalizedAppUrl;
          continue;
        }

        if (name === 'app_logo' && normalizedAppLogo !== undefined) {
          configs[name] = normalizedAppLogo;
          continue;
        }

        if (name === 'app_favicon' && normalizedAppFavicon !== undefined) {
          configs[name] = normalizedAppFavicon;
          continue;
        }

        if (name === 'app_og_image' && normalizedAppOgImage !== undefined) {
          configs[name] = normalizedAppOgImage;
          continue;
        }

        if (
          name === 'general_support_email' &&
          normalizedSupportEmail !== undefined
        ) {
          configs[name] = normalizedSupportEmail;
          continue;
        }

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
      revalidateTag(CONFIGS_CACHE_TAG, 'max');
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
