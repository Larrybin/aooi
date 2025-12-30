import 'server-only';

function cloneHeaders(headers: Headers): Headers {
  const cloned = new Headers();
  for (const [key, value] of headers.entries()) {
    cloned.append(key, value);
  }

  const maybeGetSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  if (typeof maybeGetSetCookie === 'function') {
    try {
      const setCookies = maybeGetSetCookie.call(headers);
      if (setCookies.length > 0) {
        cloned.delete('set-cookie');
        for (const cookie of setCookies) {
          cloned.append('set-cookie', cookie);
        }
      }
    } catch {
      // ignore and keep the best-effort clone from headers.entries()
    }
  }

  return cloned;
}

export function setResponseHeader(
  response: Response,
  key: string,
  value: string
): Response {
  try {
    response.headers.set(key, value);
    return response;
  } catch {
    const headers = cloneHeaders(response.headers);
    headers.set(key, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
