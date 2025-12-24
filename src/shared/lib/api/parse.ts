/**
 * Usage:
 * - `parseJson(req, Schema)` for JSON body.
 * - `parseQuery(req.url, Schema)` for URL query params.
 * - `parseParams(paramsPromise, Schema)` for Next.js Route Handler params (Promise).
 */

import type { z } from 'zod';

import { tryJsonParse } from '@/shared/lib/json';

import { BadRequestError } from './errors';

export async function parseJson<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const rawText = await req.text().catch(() => '');
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
