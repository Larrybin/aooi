import type { SettingDefinition } from '../types';
import {
  normalizeCreemProductIds,
  normalizeStripePaymentMethods,
} from '../value-rules';
import { defineSettingsGroup } from './builder';

const basicPaymentGroup = {
  id: 'basic_payment',
  titleKey: 'groups.basic_payment',
  description: 'custom your basic payment settings',
} as const;

const stripeGroup = {
  id: 'stripe',
  titleKey: 'groups.stripe',
  description:
    'custom your <a href="https://stripe.com" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Stripe</a> settings',
} as const;

const creemGroup = {
  id: 'creem',
  titleKey: 'groups.creem',
  description:
    'custom your <a href="https://www.creem.io" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Creem</a> settings',
} as const;

const paypalGroup = {
  id: 'paypal',
  titleKey: 'groups.paypal',
  description: 'custom your paypal settings',
} as const;

const basicPaymentSettings = defineSettingsGroup(
  {
    moduleId: 'billing',
    tab: 'payment',
    group: basicPaymentGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'select_payment_enabled',
      title: 'Select Payment Method Enabled',
      type: 'switch',
      value: 'false',
      tip: 'whether allow users to select payment method, if disabled, the default payment provider will be used',
      placeholder: '',
    },
    {
      name: 'default_payment_provider',
      title: 'Default Payment Provider',
      type: 'select',
      value: 'stripe',
      options: [
        {
          title: 'Stripe',
          value: 'stripe',
        },
        {
          title: 'Creem',
          value: 'creem',
        },
        {
          title: 'Paypal',
          value: 'paypal',
        },
      ],
      tip: 'Choose the default payment provider to use',
    },
  ] as const
);

const stripeSettings = defineSettingsGroup(
  {
    moduleId: 'billing',
    tab: 'payment',
    group: stripeGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'stripe_enabled',
      title: 'Stripe Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
      placeholder: '',
    },
    {
      name: 'stripe_publishable_key',
      title: 'Stripe Publishable Key',
      type: 'text',
      placeholder: 'pk_',
    },
    {
      name: 'stripe_secret_key',
      title: 'Stripe Secret Key',
      type: 'password',
      placeholder: 'sk_',
    },
    {
      name: 'stripe_signing_secret',
      title: 'Stripe Signing Secret',
      type: 'password',
      placeholder: 'whsec_',
      tip: 'Stripe Signing Secret is used to verify the webhook notification from Stripe',
    },
    {
      name: 'stripe_payment_methods',
      title: 'Stripe Payment Methods',
      type: 'checkbox',
      tip: 'If not set, only card payment method will be enabled.',
      options: [
        { title: 'Card', value: 'card' },
        { title: 'Wechat Pay', value: 'wechat_pay' },
        { title: 'Alipay', value: 'alipay' },
      ],
      value: ['card'],
      normalizer: normalizeStripePaymentMethods,
    },
  ] as const
);

const creemSettings = defineSettingsGroup(
  {
    moduleId: 'billing',
    tab: 'payment',
    group: creemGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'creem_enabled',
      title: 'Creem Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
    {
      name: 'creem_environment',
      title: 'Creem Environment',
      type: 'select',
      value: 'sandbox',
      options: [
        { title: 'Sandbox', value: 'sandbox' },
        { title: 'Production', value: 'production' },
      ],
    },
    {
      name: 'creem_api_key',
      title: 'Creem API Key',
      type: 'password',
      placeholder: 'creem_',
    },
    {
      name: 'creem_signing_secret',
      title: 'Creem Signing Secret',
      type: 'password',
      placeholder: 'whsec_',
      tip: 'Creem Signing Secret is used to verify the webhook notification from Creem',
    },
    {
      name: 'creem_product_ids',
      title: 'Creem Product IDs Mapping',
      type: 'textarea',
      attributes: {
        rows: 6,
      },
      placeholder: `{
  "starter": "prod_",
  "standard-monthly": "prod_",
  "premium-yearly": "prod_"
}`,
      tip: 'Map the product_id in pricing table to <a href="https://www.creem.io/dashboard/products" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">payment_product_id</a> created in Creem. Must be a valid JSON object.',
      normalizer: normalizeCreemProductIds,
    },
  ] as const
);

const paypalSettings = defineSettingsGroup(
  {
    moduleId: 'billing',
    tab: 'payment',
    group: paypalGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'paypal_enabled',
      title: 'Paypal Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
    {
      name: 'paypal_environment',
      title: 'Paypal Environment',
      type: 'select',
      value: 'sandbox',
      options: [
        { title: 'Sandbox', value: 'sandbox' },
        { title: 'Production', value: 'production' },
      ],
    },
    {
      name: 'paypal_client_id',
      title: 'Paypal Client ID',
      type: 'text',
      placeholder: '',
    },
    {
      name: 'paypal_client_secret',
      title: 'Paypal Client Secret',
      type: 'password',
      placeholder: '',
    },
    {
      name: 'paypal_webhook_id',
      title: 'Paypal Webhook ID',
      type: 'text',
      placeholder: '',
      tip: 'Paypal webhook id is used to verify webhook notification signatures.',
    },
  ] as const
);

export const paymentSettings = [
  ...basicPaymentSettings,
  ...stripeSettings,
  ...creemSettings,
  ...paypalSettings,
] as const satisfies readonly SettingDefinition[];
