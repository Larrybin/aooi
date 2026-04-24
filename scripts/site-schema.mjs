function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertPaymentCapability(value) {
  const allowedValues = new Set(['none', 'stripe', 'creem', 'paypal']);
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw new Error(
      'capabilities.payment must be one of: none, stripe, creem, paypal'
    );
  }
}

function assertAppUrl(value, label) {
  assertNonEmptyString(value, label);

  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${label} must be a valid URL (${String(error)})`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} must use http/https`);
  }
}

export function validateSiteConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('site config must be an object');
  }

  assertNonEmptyString(config.key, 'site.key');
  assertNonEmptyString(config.domain, 'site.domain');

  if (!config.brand || typeof config.brand !== 'object' || Array.isArray(config.brand)) {
    throw new Error('site.brand is required');
  }

  assertNonEmptyString(config.brand.appName, 'site.brand.appName');
  assertAppUrl(config.brand.appUrl, 'site.brand.appUrl');
  assertNonEmptyString(config.brand.supportEmail, 'site.brand.supportEmail');
  assertNonEmptyString(config.brand.logo, 'site.brand.logo');
  assertNonEmptyString(config.brand.favicon, 'site.brand.favicon');
  assertNonEmptyString(config.brand.previewImage, 'site.brand.previewImage');

  if (
    !config.capabilities ||
    typeof config.capabilities !== 'object' ||
    Array.isArray(config.capabilities)
  ) {
    throw new Error('site.capabilities is required');
  }

  assertBoolean(config.capabilities.auth, 'site.capabilities.auth');
  assertPaymentCapability(config.capabilities.payment);
  assertBoolean(config.capabilities.ai, 'site.capabilities.ai');
  assertBoolean(config.capabilities.docs, 'site.capabilities.docs');
  assertBoolean(config.capabilities.blog, 'site.capabilities.blog');

  if (config.configVersion !== 1) {
    throw new Error('site.configVersion must equal 1');
  }
}
