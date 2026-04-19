const FIXED_REMOTE_IMAGE_HOSTS = ['models.dev'];

function isHttpUrl(value) {
  return value.startsWith('http://') || value.startsWith('https://');
}

export const KNOWN_FIXED_REMOTE_IMAGE_HOSTS = Object.freeze(
  [...FIXED_REMOTE_IMAGE_HOSTS].sort()
);

export const NEXT_IMAGE_REMOTE_PATTERNS = Object.freeze(
  KNOWN_FIXED_REMOTE_IMAGE_HOSTS.map((hostname) => ({
    protocol: 'https',
    hostname,
    pathname: '/**',
  }))
);

export function isFixedRemoteImageHost(hostname) {
  return KNOWN_FIXED_REMOTE_IMAGE_HOSTS.includes(hostname);
}

export function resolveImageSourceStrategy(src, options = {}) {
  const trimmed = typeof src === 'string' ? src.trim() : '';
  if (!trimmed) {
    return {
      kind: 'empty',
      resolvedSrc: '',
    };
  }

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return {
      kind: 'next-image',
      resolvedSrc: trimmed,
    };
  }

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return {
      kind: 'img',
      resolvedSrc: trimmed,
    };
  }

  if (!isHttpUrl(trimmed)) {
    return {
      kind: 'img',
      resolvedSrc: trimmed,
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return {
      kind: 'img',
      resolvedSrc: trimmed,
    };
  }

  const candidateOrigins = new Set();
  const pushOrigin = (value) => {
    if (!value || typeof value !== 'string') {
      return;
    }

    try {
      candidateOrigins.add(new URL(value).origin);
    } catch {
      // Ignore invalid origins from non-browser contexts.
    }
  };

  pushOrigin(options.appOrigin);

  if (typeof window !== 'undefined') {
    pushOrigin(window.location.origin);
  }

  if (candidateOrigins.has(parsedUrl.origin)) {
    return {
      kind: 'next-image',
      resolvedSrc: trimmed,
    };
  }

  if (isFixedRemoteImageHost(parsedUrl.hostname)) {
    return {
      kind: 'next-image',
      resolvedSrc: trimmed,
    };
  }

  return {
    kind: 'img',
    resolvedSrc: trimmed,
  };
}
