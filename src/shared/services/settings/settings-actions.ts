import 'server-only';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { parseFormData } from '@/shared/lib/action/form';
import {
  type PermissionCode,
  requireActionPermissions,
  requireActionUser,
} from '@/shared/lib/action/guard';
import { actionErr, actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { PUBLIC_CONFIGS_CACHE_TAG } from '@/shared/lib/public-configs-cache';
import {
  CONFIGS_CACHE_TAG,
  saveConfigs,
  type Configs,
} from '@/shared/models/config';

import { normalizeSettingOverrides } from './settings-normalizers';

const SETTINGS_FORM_VALUES_SCHEMA = z.record(z.string(), z.string());

type SettingsSubmitAction = (
  data: FormData,
  passby: unknown
) => Promise<
  | {
      status: 'success' | 'error';
      message: string;
      redirect_url?: string;
      requestId?: string;
    }
  | undefined
  | void
>;

export function createSettingsSubmitAction({
  initialConfigs,
  hasConfigsError,
  requiredPermissions,
}: {
  initialConfigs: Configs;
  hasConfigsError: boolean;
  requiredPermissions: [PermissionCode, PermissionCode];
}): SettingsSubmitAction {
  return async (data, _passby) => {
    'use server';

    return withAction(async () => {
      const user = await requireActionUser();
      await requireActionPermissions(user.id, ...requiredPermissions);

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

      const nextConfigs: Configs = { ...initialConfigs };
      for (const [name, value] of Object.entries(values)) {
        nextConfigs[name] = normalizedOverrides.value[name] ?? value;
      }

      await saveConfigs(nextConfigs);
      revalidateTag(CONFIGS_CACHE_TAG, 'max');
      revalidateTag(PUBLIC_CONFIGS_CACHE_TAG, 'max');

      return actionOk('Settings updated');
    });
  };
}
