import type { SettingDefinition } from '../types';
import {
  normalizeCreemProductIds,
  normalizeStripePaymentMethods,
} from '../value-rules';
import { defineSettingsGroup } from './builder';

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

const stripeSettings = defineSettingsGroup(
  {
    moduleId: 'billing',
    tab: 'payment',
    group: stripeGroup,
    defaultVisibility: 'private',
  },
  [
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
      name: 'paypal_environment',
      title: 'Paypal Environment',
      type: 'select',
      value: 'sandbox',
      options: [
        { title: 'Sandbox', value: 'sandbox' },
        { title: 'Production', value: 'production' },
      ],
    },
  ] as const
);

export const paymentSettings = [
  ...stripeSettings,
  ...creemSettings,
  ...paypalSettings,
] as const satisfies readonly SettingDefinition[];
