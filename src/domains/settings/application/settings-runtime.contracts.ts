import type {
  ActivePaymentCapability,
  PaymentCapability,
} from '@/config/payment-capability';
import type { NavItem } from '@/shared/types/blocks/common';

export type PublicUiConfig = {
  aiEnabled: boolean;
  localeSwitcherEnabled: boolean;
  socialLinksEnabled: boolean;
  socialLinksJson: string;
  socialLinks: NavItem[];
  affiliate: {
    affonsoEnabled: boolean;
    promotekitEnabled: boolean;
  };
};

export type AuthUiRuntimeSettings = {
  emailAuthEnabled: boolean;
  googleAuthEnabled: boolean;
  googleOneTapEnabled: boolean;
  googleClientId: string;
  githubAuthEnabled: boolean;
};

export type AuthServerBindings = {
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
};

type BillingRuntimeSharedSettings = {
  locale: string;
  defaultLocale: string;
};

export type BillingRuntimeSettings =
  | (BillingRuntimeSharedSettings & {
      provider: 'none';
      paymentCapability: 'none';
    })
  | (BillingRuntimeSharedSettings & {
      provider: 'stripe';
      paymentCapability: 'stripe';
      stripePaymentMethods: string;
    })
  | (BillingRuntimeSharedSettings & {
      provider: 'creem';
      paymentCapability: 'creem';
      creemEnvironment: 'sandbox' | 'production';
      creemProductIds: string;
    })
  | (BillingRuntimeSharedSettings & {
      provider: 'paypal';
      paymentCapability: 'paypal';
      paypalEnvironment: 'sandbox' | 'production';
    });

export type ActiveBillingRuntimeSettings = Extract<
  BillingRuntimeSettings,
  { provider: ActivePaymentCapability }
>;

export type PaymentRuntimeBindings =
  | {
      provider: 'none';
      paymentCapability: 'none';
    }
  | {
      provider: 'stripe';
      paymentCapability: 'stripe';
      stripePublishableKey: string;
      stripeSecretKey: string;
      stripeSigningSecret: string;
    }
  | {
      provider: 'creem';
      paymentCapability: 'creem';
      creemApiKey: string;
      creemSigningSecret: string;
    }
  | {
      provider: 'paypal';
      paymentCapability: 'paypal';
      paypalClientId: string;
      paypalClientSecret: string;
      paypalWebhookId: string;
    };

export type ActivePaymentRuntimeBindings = Extract<
  PaymentRuntimeBindings,
  { provider: ActivePaymentCapability }
>;

export type PaymentCapabilitySnapshot = {
  capability: PaymentCapability;
};

export type AiRuntimeSettings = {
  aiEnabled: boolean;
};

export type AiProviderBindings = {
  openrouterApiKey: string;
  replicateApiToken: string;
  falApiKey: string;
  kieApiKey: string;
};
