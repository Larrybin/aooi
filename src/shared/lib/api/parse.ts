/**
 * Usage:
 * - `parseJson(req, Schema)` for JSON body.
 * - `parseQuery(req.url, Schema)` for URL query params.
 * - `parseParams(paramsPromise, Schema)` for Next.js Route Handler params (Promise).
 */

import 'server-only';

import type { z } from 'zod';

import { tryJsonParse } from '@/shared/lib/json';
import { getRequestLogger } from '@/shared/lib/request-logger.server';

import { BadRequestError } from './errors';

function isAbortError(error: unknown): boolean {
  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name
  ) {
    return error.name === 'AbortError';
  }

  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  return false;
}

export async function parseJson<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  let rawText = '';
  try {
    rawText = await req.text();
  } catch (error: unknown) {
    const { log } = getRequestLogger(req);

    if (isAbortError(error)) {
      log.debug('api: request body read aborted', { error });
    } else {
      log.error('api: failed to read request body', { error });
    }

    throw new BadRequestError('invalid json body');
  }
  const parsed = tryJsonParse<unknown>(rawText);
  if (!parsed.ok) {
    throw new BadRequestError('invalid json body');
  }
  const value: unknown = parsed.value;

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError('invalid request params', {
      issues: result.error.issues,
    });
  }

  return result.data;
}

export function parseQuery<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema
): z.infer<TSchema> {
  const { searchParams } = new URL(url);
  const value = Object.fromEntries(searchParams.entries());

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError('invalid request params', {
      issues: result.error.issues,
    });
  }

  return result.data;
}

export async function parseParams<TSchema extends z.ZodTypeAny>(
  paramsPromise: Promise<unknown>,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const params = await paramsPromise;
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new BadRequestError('invalid route params', {
      issues: result.error.issues,
    });
  }
  return result.data;
}
