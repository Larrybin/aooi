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

export type BillingRuntimeSettings = {
  locale: string;
  defaultLocale: string;
  selectPaymentEnabled: boolean;
  defaultPaymentProvider: string;
  stripeEnabled: boolean;
  stripePaymentMethods: string;
  creemEnabled: boolean;
  creemEnvironment: 'sandbox' | 'production';
  creemProductIds: string;
  paypalEnabled: boolean;
  paypalEnvironment: 'sandbox' | 'production';
};

export type PaymentRuntimeBindings = {
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeSigningSecret: string;
  creemApiKey: string;
  creemSigningSecret: string;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalWebhookId: string;
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
