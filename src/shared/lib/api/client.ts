'use client';

import {
  getRequestIdFromResponse,
  RequestIdError,
} from '@/shared/lib/api/request-id';
import { safeJsonParse } from '@/shared/lib/json';

type ApiEnvelope<T> = {
  code: number;
  message?: string;
  data?: T;
};

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false;
  return 'code' in value;
}

function toUrlString(input: RequestInfo | URL): string | undefined {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request)
    return input.url;
  return undefined;
}

type FetchApiOptions<T> = {
  validate?: (data: unknown) => data is T;
  invalidDataMessage?: string;
};

export async function fetchApiData<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchApiOptions<T> & { returnEnvelope?: false }
): Promise<T>;
export async function fetchApiData<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: FetchApiOptions<T> & { returnEnvelope: true }
): Promise<{ data: T; message?: string }>;
export async function fetchApiData<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchApiOptions<T> & { returnEnvelope?: boolean }
): Promise<T | { data: T; message?: string }> {
  const response = await fetch(input, init);
  const requestId = getRequestIdFromResponse(response);
  const url = toUrlString(input);

  const rawText = await response.text();
  const parsed = safeJsonParse<unknown>(rawText);

  if (isApiEnvelope(parsed)) {
    const ok = response.ok && parsed.code === 0;
    if (!ok) {
      const message =
        typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message.trim()
          : `request failed with status ${response.status}`;
      throw new RequestIdError(message, requestId, {
        status: response.status,
        url,
      });
    }

    const data = parsed.data as unknown;
    if (options?.validate && !options.validate(data)) {
      throw new RequestIdError(
        options.invalidDataMessage || 'invalid response',
        requestId,
        {
          status: response.status,
          url,
        }
      );
    }

    if (options?.returnEnvelope) {
      return { data: data as T, message: parsed.message };
    }
    return data as T;
  }

  if (!response.ok) {
    throw new RequestIdError(
      `request failed with status ${response.status}`,
      requestId,
      {
        status: response.status,
        url,
      }
    );
  }

  if (parsed === null) {
    if (!rawText.trim()) {
      if (options?.returnEnvelope) return { data: null as T };
      return null as T;
    }
    throw new RequestIdError('invalid json response', requestId, {
      status: response.status,
      url,
    });
  }

  if (options?.validate && !options.validate(parsed)) {
    throw new RequestIdError(
      options.invalidDataMessage || 'invalid response',
      requestId,
      {
        status: response.status,
        url,
      }
    );
  }

  if (options?.returnEnvelope) return { data: parsed as T };
  return parsed as T;
}
