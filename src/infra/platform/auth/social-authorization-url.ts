type NormalizeSocialAuthorizationUrlParams = {
  authorizationUrl: string;
  provider: string;
  runtimeOrigin: string;
};

function buildExpectedCallbackPath(provider: string) {
  return `/api/auth/callback/${provider}`;
}

export function normalizeSocialAuthorizationUrl({
  authorizationUrl,
  provider,
  runtimeOrigin,
}: NormalizeSocialAuthorizationUrlParams) {
  try {
    const authUrl = new URL(authorizationUrl);
    const redirectUri = authUrl.searchParams.get('redirect_uri');

    if (!redirectUri) {
      return authorizationUrl;
    }

    const expectedRuntimeOrigin = new URL(runtimeOrigin).origin;
    const redirectUrl = new URL(redirectUri);

    if (redirectUrl.pathname !== buildExpectedCallbackPath(provider)) {
      return authorizationUrl;
    }

    if (redirectUrl.origin === expectedRuntimeOrigin) {
      return authorizationUrl;
    }

    const normalizedRedirectUrl = new URL(redirectUrl.toString());
    normalizedRedirectUrl.protocol = new URL(expectedRuntimeOrigin).protocol;
    normalizedRedirectUrl.host = new URL(expectedRuntimeOrigin).host;
    authUrl.searchParams.set('redirect_uri', normalizedRedirectUrl.toString());

    return authUrl.toString();
  } catch {
    return authorizationUrl;
  }
}
