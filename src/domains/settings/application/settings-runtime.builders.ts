import {
  AI_RUNTIME_SETTING_KEYS,
  AUTH_RUNTIME_SETTING_KEYS,
  BILLING_RUNTIME_SETTING_KEYS,
  PUBLIC_UI_SETTING_KEYS,
} from '@/domains/settings/registry';
import type { PaymentCapability } from '@/config/payment-capability';
import { site } from '@/site';

import { parseGeneralSocialLinks } from '@/shared/lib/general-ui.client';

import type {
  AiRuntimeSettings,
  AuthServerBindings,
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  PublicUiConfig,
} from './settings-runtime.contracts';
import type { Configs } from './settings-store';

function isEnabled(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === 'true';
}

function readString(value: string | undefined): string {
  return value ?? '';
}

export function buildPublicUiConfig(configs: Configs): PublicUiConfig {
  const socialLinksJson = readString(
    configs[PUBLIC_UI_SETTING_KEYS.socialLinks]
  );

  return {
    aiEnabled: isEnabled(configs[PUBLIC_UI_SETTING_KEYS.aiEnabled]),
    localeSwitcherEnabled: isEnabled(
      configs[PUBLIC_UI_SETTING_KEYS.localeSwitcherEnabled]
    ),
    socialLinksEnabled: isEnabled(
      configs[PUBLIC_UI_SETTING_KEYS.socialLinksEnabled]
    ),
    socialLinksJson,
    socialLinks: parseGeneralSocialLinks(socialLinksJson),
    affiliate: {
      affonsoEnabled: isEnabled(configs[PUBLIC_UI_SETTING_KEYS.affonsoEnabled]),
      promotekitEnabled: isEnabled(
        configs[PUBLIC_UI_SETTING_KEYS.promotekitEnabled]
      ),
    },
  };
}

export function buildAuthUiRuntimeSettings(
  configs: Configs,
  bindings: AuthServerBindings
): AuthUiRuntimeSettings {
  const googleRequested = isEnabled(
    configs[AUTH_RUNTIME_SETTING_KEYS.googleAuthEnabled]
  );
  const githubRequested = isEnabled(
    configs[AUTH_RUNTIME_SETTING_KEYS.githubAuthEnabled]
  );
  const googleBindingsReady = !!(
    bindings.googleClientId.trim() && bindings.googleClientSecret.trim()
  );
  const githubBindingsReady = !!(
    bindings.githubClientId.trim() && bindings.githubClientSecret.trim()
  );
  const googleAuthEnabled = googleRequested && googleBindingsReady;
  const githubAuthEnabled = githubRequested && githubBindingsReady;
  const googleClientId = googleAuthEnabled
    ? readString(bindings.googleClientId)
    : '';

  return {
    emailAuthEnabled:
      isEnabled(configs[AUTH_RUNTIME_SETTING_KEYS.emailAuthEnabled], true) ||
      (!googleAuthEnabled && !githubAuthEnabled),
    googleAuthEnabled,
    googleOneTapEnabled:
      googleAuthEnabled &&
      !!googleClientId &&
      isEnabled(configs[AUTH_RUNTIME_SETTING_KEYS.googleOneTapEnabled]),
    googleClientId,
    githubAuthEnabled,
  };
}

export function buildBillingRuntimeSettings(
  configs: Configs
): BillingRuntimeSettings {
  const shared = {
    locale: readString(configs[BILLING_RUNTIME_SETTING_KEYS.locale]),
    defaultLocale: readString(
      configs[BILLING_RUNTIME_SETTING_KEYS.defaultLocale]
    ),
  } as const;
  const paymentCapability = site.capabilities.payment as PaymentCapability;

  switch (paymentCapability) {
    case 'none':
      return {
        ...shared,
        provider: 'none',
        paymentCapability: 'none',
      };
    case 'stripe':
      return {
        ...shared,
        provider: 'stripe',
        paymentCapability: 'stripe',
        stripePaymentMethods: readString(
          configs[BILLING_RUNTIME_SETTING_KEYS.stripePaymentMethods]
        ),
      };
    case 'creem':
      return {
        ...shared,
        provider: 'creem',
        paymentCapability: 'creem',
        creemEnvironment:
          configs[BILLING_RUNTIME_SETTING_KEYS.creemEnvironment] === 'production'
            ? 'production'
            : 'sandbox',
        creemProductIds: readString(
          configs[BILLING_RUNTIME_SETTING_KEYS.creemProductIds]
        ),
      };
    case 'paypal':
      return {
        ...shared,
        provider: 'paypal',
        paymentCapability: 'paypal',
        paypalEnvironment:
          configs[BILLING_RUNTIME_SETTING_KEYS.paypalEnvironment] === 'production'
            ? 'production'
            : 'sandbox',
      };
  }
}

export function buildAiRuntimeSettings(configs: Configs): AiRuntimeSettings {
  return {
    aiEnabled: isEnabled(configs[AI_RUNTIME_SETTING_KEYS.aiEnabled]),
  };
}
