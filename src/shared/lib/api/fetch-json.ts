'use client';

import { toast } from 'sonner';

import { fetchApiData } from '@/shared/lib/api/client';
import {
  formatMessageWithRequestId,
  getRequestIdFromError,
} from '@/shared/lib/api/request-id';

export type FetchJsonInit = Omit<RequestInit, 'body' | 'headers'> & {
  headers?: HeadersInit;
  body?: unknown;
};

type FetchJsonOptions<T> = {
  validate?: (data: unknown) => data is T;
  invalidDataMessage?: string;
};

function toJsonBody(value: unknown): string | undefined {
  if (typeof value === 'undefined') return undefined;
  return JSON.stringify(value);
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: FetchJsonInit,
  options?: FetchJsonOptions<T>
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetchApiData<T>(
    input,
    { ...init, headers, body: toJsonBody(init?.body) },
    options
  ) as Promise<T>;
}

export async function fetchJsonEnvelope<T>(
  input: RequestInfo | URL,
  init?: FetchJsonInit,
  options?: FetchJsonOptions<T>
): Promise<{ data: T; message?: string }> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetchApiData<T>(
    input,
    { ...init, headers, body: toJsonBody(init?.body) },
    { ...options, returnEnvelope: true }
  ) as Promise<{ data: T; message?: string }>;
}

export function toastFetchError(error: unknown, message: string): void {
  toast.error(
    formatMessageWithRequestId(message, getRequestIdFromError(error))
  );
}
