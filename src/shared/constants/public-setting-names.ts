export const PUBLIC_SETTING_NAMES = [
  'general_built_with_enabled',
  'general_theme_toggle_enabled',
  'general_social_links_enabled',
  'general_social_links',
  'email_auth_enabled',
  'google_auth_enabled',
  'google_one_tap_enabled',
  'google_client_id',
  'github_auth_enabled',
  'select_payment_enabled',
  'default_payment_provider',
  'stripe_enabled',
  'creem_enabled',
  'paypal_enabled',
  'affonso_enabled',
  'promotekit_enabled',
  'crisp_enabled',
  'tawk_enabled',
 ] as const;

export const publicSettingNames: readonly string[] = PUBLIC_SETTING_NAMES;
