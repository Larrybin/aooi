import type { z } from 'zod';

import { sanitizeUrlForLog } from '@/shared/lib/fetch/sanitize-url';
import { fetchWithTimeout } from '@/shared/lib/fetch/timeout';
import { safeJsonParse } from '@/shared/lib/json';

type FetchServerOptions = {
  timeoutMs: number;
  cache?: RequestCache;
};

type FetchServerErrorOptions = FetchServerOptions & {
  errorMessage?: string;
};

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
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
  return fetchWithTimeout(url, { ...init, cache }, { timeoutMs });
}

export async function safeFetchJson<T>(
  url: string,
  init?: RequestInit,
  options?: FetchServerErrorOptions
): Promise<T> {
  const response = await safeFetch(url, init, options);
  const rawText = await safeReadText(response);
  const parsed = safeJsonParse<unknown>(rawText);

  if (!response.ok) {
    const detail =
      extractErrorDetail(parsed) || rawText.trim().slice(0, 300) || undefined;
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }

  if (parsed === null) {
    if (!rawText.trim()) {
      return null as T;
    }
    throw new Error(
      `${options?.errorMessage || 'invalid json response'}: ${sanitizeUrlForLog(url)}`
    );
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
  const response = await safeFetch(url, init, options);
  const rawText = await safeReadText(response);
  const parsed = safeJsonParse<unknown>(rawText);

  if (!response.ok) {
    const detail =
      extractErrorDetail(parsed) || rawText.trim().slice(0, 300) || undefined;
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }

  if (parsed === null) {
    if (!rawText.trim()) {
      return null as z.infer<TSchema>;
    }
    throw new Error(
      `${options?.errorMessage || 'invalid json response'}: ${sanitizeUrlForLog(url)}`
    );
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
  const response = await safeFetch(url, init, options);
  if (!response.ok) {
    const rawText = await safeReadText(response);
    const parsed = safeJsonParse<unknown>(rawText);
    const detail =
      extractErrorDetail(parsed) || rawText.trim().slice(0, 300) || undefined;
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }
  return await response.arrayBuffer();
}

export async function safeFetchText(
  url: string,
  init?: RequestInit,
  options?: FetchServerErrorOptions
): Promise<string> {
  const response = await safeFetch(url, init, options);
  const text = await safeReadText(response);
  if (!response.ok) {
    const parsed = safeJsonParse<unknown>(text);
    const detail =
      extractErrorDetail(parsed) || text.trim().slice(0, 300) || undefined;
    throw buildFetchError(url, response, detail, options?.errorMessage);
  }
  return text;
}
