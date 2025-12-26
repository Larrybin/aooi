import type { z } from 'zod';

import { checkOutboundUrl } from '@/shared/lib/fetch/outbound-url';
import { sanitizeUrlForLog } from '@/shared/lib/fetch/sanitize-url';
import { fetchWithTimeout } from '@/shared/lib/fetch/timeout';
import { safeJsonParse, tryJsonParse } from '@/shared/lib/json';
import { logger } from '@/shared/lib/logger.server';

type FetchServerOptions = {
  timeoutMs: number;
  cache?: RequestCache;
  allowInsecureHttp?: boolean;
  allowPrivateNetwork?: boolean;
  maxRedirects?: number;
};

type FetchServerErrorOptions = FetchServerOptions & {
  errorMessage?: string;
};

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error: unknown) {
    const safeUrl = sanitizeUrlForLog(response.url);
    logger.error('fetch: failed to read response body', {
      url: safeUrl,
      status: response.status,
      statusText: response.statusText,
      error,
    });

    const wrapped = new Error(
      `failed to read response body: ${safeUrl || '(unknown)'}`
    );
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
}

function formatZodIssues(issues: Array<z.ZodIssue>): string {
  return issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .slice(0, 10)
    .join('; ');
}

function extractErrorDetail(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;

  const value = parsed as Record<string, unknown>;
  const candidates = [
    value.message,
    value.error_description,
    value.error,
    value.name,
    value.msg,
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }
  return undefined;
}

type ParsedBody = {
  rawText: string;
  parsed: unknown;
  parsedOk: boolean;
  parseError?: unknown;
};

async function readTextAndParsed(response: Response): Promise<ParsedBody> {
  const rawText = await safeReadText(response);
  if (!rawText.trim()) {
    return { rawText, parsed: null, parsedOk: false };
  }

  const parsed = tryJsonParse<unknown>(rawText);
  if (!parsed.ok) {
    return {
      rawText,
      parsed: null,
      parsedOk: false,
      parseError: parsed.error,
    };
  }

  return { rawText, parsed: parsed.value, parsedOk: true };
}

function buildResponseErrorDetail(parsed: unknown, rawText: string) {
  return (
    extractErrorDetail(parsed) || rawText.trim().slice(0, 300) || undefined
  );
}

function buildInvalidJsonError(url: string, errorMessage?: string): Error {
  return new Error(
    `${errorMessage || 'invalid json response'}: ${sanitizeUrlForLog(url)}`
  );
}

function buildFetchError(
  url: string,
  response: Response,
  detail?: string,
  errorMessage?: string
): Error {
  const safeUrl = sanitizeUrlForLog(url);
  const base = errorMessage || 'request failed';
  const suffix = detail ? `: ${detail}` : '';
  return new Error(
    `${base}: ${response.status} ${response.statusText} ${safeUrl}${suffix}`
  );
}

export async function safeFetch(
  url: string,
  init?: RequestInit,
  options?: FetchServerOptions
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const cache = options?.cache ?? 'no-store';
  const checkResult = checkOutboundUrl(url, {
    allowInsecureHttp: options?.allowInsecureHttp,
    allowPrivateNetwork: options?.allowPrivateNetwork,
  });
  if (!checkResult.ok) {
    const safeUrl = sanitizeUrlForLog(url);
    const base =
      (options as FetchServerErrorOptions | undefined)?.errorMessage ||
      'blocked outbound request';
    throw new Error(`${base}: ${safeUrl} (${checkResult.reason})`);
  }

  return fetchWithTimeout(
    checkResult.url,
    {
      ...init,
      cache,
      redirect: init?.redirect ?? 'manual',
    },
    { timeoutMs }
  );
}

function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

function stripSensitiveHeaders(headers: HeadersInit | undefined): HeadersInit {
  if (!headers) return [];

  const banned = new Set(['authorization', 'cookie', 'proxy-authorization']);
  const entries: Array<[string, string]> = [];

  if (headers instanceof Headers) {
    for (const [key, value] of headers.entries()) {
      if (!banned.has(key.toLowerCase())) entries.push([key, value]);
    }
    return entries;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      if (!banned.has(key.toLowerCase())) entries.push([key, value]);
    }
    return entries;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'string') continue;
    if (!banned.has(key.toLowerCase())) entries.push([key, value]);
  }

  return entries;
}

export async function safeFetchFollowingRedirects(
  url: string,
  init?: RequestInit,
  options?: FetchServerOptions
): Promise<Response> {
  const maxRedirects = Math.max(0, options?.maxRedirects ?? 5);
  let currentUrl = url;
  let currentInit = init;

  for (let i = 0; i <= maxRedirects; i += 1) {
    const response = await safeFetch(
      currentUrl,
      { ...currentInit, redirect: 'manual' },
      options
    );

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      return response;
    }

    try {
      await response.body?.cancel();
    } catch {}

    const nextUrl = new URL(location, response.url).toString();
    const nextOrigin = new URL(nextUrl).origin;
    const currentOrigin = new URL(response.url).origin;
    currentUrl = nextUrl;

    const method = (currentInit?.method ?? 'GET').toUpperCase();
    const shouldRewriteMethod =
      (response.status === 303 && method !== 'GET' && method !== 'HEAD') ||
      ((response.status === 301 || response.status === 302) &&
        method === 'POST');

    if (shouldRewriteMethod) {
      currentInit = {
        ...currentInit,
        method: 'GET',
        body: undefined,
      };
    }

    if (nextOrigin !== currentOrigin) {
      currentInit = {
        ...currentInit,
        headers: stripSensitiveHeaders(currentInit?.headers),
      };
    }
  }

  throw new Error(`too many redirects: ${sanitizeUrlForLog(url)}`);
}

export async function safeFetchJson<T>(
  url: string,
  init?: RequestInit,
  options?: FetchServerErrorOptions
): Promise<T> {
  const response = await safeFetchFollowingRedirects(url, init, options);
  const { rawText, parsed } = await readTextAndParsed(response);

  if (!response.ok) {
    const detail = buildResponseErrorDetail(parsed, rawText);
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }

  if (parsed === null) {
    if (!rawText.trim()) {
      return null as T;
    }
    throw buildInvalidJsonError(url, options?.errorMessage);
  }

  return parsed as T;
}

export async function safeFetchJsonWithSchema<TSchema extends z.ZodTypeAny>(
  url: string,
  init: RequestInit | undefined,
  schema: TSchema,
  options?: FetchServerErrorOptions & {
    invalidDataMessage?: string;
  }
): Promise<z.infer<TSchema>> {
  const response = await safeFetchFollowingRedirects(url, init, options);
  const { rawText, parsed, parsedOk, parseError } =
    await readTextAndParsed(response);

  if (!response.ok) {
    const detail = buildResponseErrorDetail(parsed, rawText);
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }

  if (!parsedOk) {
    const trimmed = rawText.trim();
    const safeUrl = sanitizeUrlForLog(response.url || url);

    if (!trimmed) {
      const maybeNull = schema.safeParse(null);
      if (maybeNull.success) {
        return maybeNull.data;
      }

      const message =
        options?.invalidDataMessage || options?.errorMessage || 'invalid json';
      logger.error('fetch: empty json response body', {
        url: safeUrl,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`${message}: ${safeUrl} (empty response body)`);
    }

    const invalid = buildInvalidJsonError(
      url,
      options?.invalidDataMessage || options?.errorMessage
    );
    (invalid as Error & { cause?: unknown }).cause = parseError;
    logger.error('fetch: invalid json response', {
      url: safeUrl,
      status: response.status,
      statusText: response.statusText,
      error: parseError,
    });
    throw invalid;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const detail = formatZodIssues(result.error.issues);
    const message = options?.invalidDataMessage || 'invalid json response';
    throw new Error(`${message}: ${sanitizeUrlForLog(url)} (${detail})`);
  }

  return result.data;
}

export async function safeFetchArrayBuffer(
  url: string,
  init?: RequestInit,
  options?: FetchServerErrorOptions
): Promise<ArrayBuffer> {
  const response = await safeFetchFollowingRedirects(url, init, options);
  if (!response.ok) {
    const { rawText, parsed } = await readTextAndParsed(response);
    const detail = buildResponseErrorDetail(parsed, rawText);
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }
  return await response.arrayBuffer();
}

export async function safeFetchText(
  url: string,
  init?: RequestInit,
  options?: FetchServerErrorOptions
): Promise<string> {
  const response = await safeFetchFollowingRedirects(url, init, options);
  const text = await safeReadText(response);
  if (!response.ok) {
    const parsed = safeJsonParse<unknown>(text);
    const detail = buildResponseErrorDetail(parsed, text);
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }
  return text;
}
