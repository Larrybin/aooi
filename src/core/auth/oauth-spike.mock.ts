type MockProfile = {
  email: string;
  id: string;
  image: string;
  name: string;
};

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_ENDPOINT = 'https://api.github.com/user';
const GITHUB_EMAILS_ENDPOINT = 'https://api.github.com/user/emails';

const GOOGLE_CODE_PREFIX = 'oauth-spike-google-';
const GITHUB_CODE_PREFIX = 'oauth-spike-github-';
const GITHUB_TOKEN_PREFIX = 'oauth-spike-github-access-token-';

const GOOGLE_PROFILE: MockProfile = {
  id: 'oauth-spike-google-user',
  name: 'OAuth Spike Google User',
  email: 'oauth-spike-google@example.com',
  image: 'https://example.com/oauth-spike-google.png',
};

const GITHUB_PROFILE: MockProfile = {
  id: 'oauth-spike-github-user',
  name: 'OAuth Spike GitHub User',
  email: 'oauth-spike-github@example.com',
  image: 'https://example.com/oauth-spike-github.png',
};

type GlobalFetchPatchState = typeof globalThis & {
  __authSpikeOauthFetchInstalled?: boolean;
  __authSpikeOauthOriginalFetch?: typeof fetch;
};

function isOAuthSpikeMockEnabled() {
  return process.env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK === 'true';
}

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

function encodeJwtSegment(value: unknown) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64url')
    .replace(/=/g, '');
}

function createMockGoogleIdToken(profile: MockProfile) {
  return [
    encodeJwtSegment({ alg: 'none', typ: 'JWT' }),
    encodeJwtSegment({
      sub: profile.id,
      name: profile.name,
      email: profile.email,
      picture: profile.image,
      email_verified: true,
    }),
    '',
  ].join('.');
}

function buildGithubAccessToken(code: string) {
  return `${GITHUB_TOKEN_PREFIX}${code.slice(GITHUB_CODE_PREFIX.length)}`;
}

async function readRequestBody(request: Request) {
  const text = await request.text();
  return new URLSearchParams(text);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')?.trim() || '';
  const match = authorization.match(/^bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function handleAuthSpikeOAuthMockRequest(
  request: Request
): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.toString() === GOOGLE_TOKEN_ENDPOINT) {
    const body = await readRequestBody(request);
    const code = body.get('code')?.trim() || '';

    if (!code.startsWith(GOOGLE_CODE_PREFIX)) {
      return null;
    }

    return createJsonResponse({
      access_token: `oauth-spike-google-access-token-${code.slice(GOOGLE_CODE_PREFIX.length)}`,
      expires_in: 3600,
      id_token: createMockGoogleIdToken(GOOGLE_PROFILE),
      scope: 'openid email profile',
      token_type: 'Bearer',
    });
  }

  if (request.method === 'POST' && url.toString() === GITHUB_TOKEN_ENDPOINT) {
    const body = await readRequestBody(request);
    const code = body.get('code')?.trim() || '';

    if (!code.startsWith(GITHUB_CODE_PREFIX)) {
      return null;
    }

    return createJsonResponse({
      access_token: buildGithubAccessToken(code),
      scope: 'read:user user:email',
      token_type: 'bearer',
    });
  }

  if (request.method === 'GET' && url.toString() === GITHUB_USER_ENDPOINT) {
    const token = getBearerToken(request);

    if (!token?.startsWith(GITHUB_TOKEN_PREFIX)) {
      return null;
    }

    return createJsonResponse({
      id: GITHUB_PROFILE.id,
      login: 'oauth-spike-github-user',
      name: GITHUB_PROFILE.name,
      email: GITHUB_PROFILE.email,
      avatar_url: GITHUB_PROFILE.image,
    });
  }

  if (request.method === 'GET' && url.toString() === GITHUB_EMAILS_ENDPOINT) {
    const token = getBearerToken(request);

    if (!token?.startsWith(GITHUB_TOKEN_PREFIX)) {
      return null;
    }

    return createJsonResponse([
      {
        email: GITHUB_PROFILE.email,
        primary: true,
        verified: true,
      },
    ]);
  }

  return null;
}

export function installAuthSpikeOAuthFetchMock() {
  if (!isOAuthSpikeMockEnabled()) {
    return;
  }

  const globalState = globalThis as GlobalFetchPatchState;
  if (globalState.__authSpikeOauthFetchInstalled) {
    return;
  }

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalState.__authSpikeOauthOriginalFetch = originalFetch;
  globalState.__authSpikeOauthFetchInstalled = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request ? input.clone() : new Request(input, init);
    const mockedResponse = await handleAuthSpikeOAuthMockRequest(
      request as Request
    );

    if (mockedResponse) {
      return mockedResponse;
    }

    return originalFetch(input, init);
  };
}
