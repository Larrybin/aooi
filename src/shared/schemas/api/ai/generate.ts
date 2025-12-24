/**
 * Usage: `parseJson(req, AiGenerateBodySchema)`
 */

import { z } from 'zod';

import { AIMediaType } from '@/extensions/ai';
import { safeJsonStringify, utf8ByteLength } from '@/shared/lib/utf8';

const MAX_PROMPT_CHARS = 20_000;
const MAX_OPTIONS_JSON_BYTES = 64 * 1024;

export const AiGenerateBodySchema = z
  .object({
    provider: z.string().min(1),
    mediaType: z.nativeEnum(AIMediaType),
    model: z.string().min(1),
    prompt: z.string().max(MAX_PROMPT_CHARS).optional().default(''),
    options: z.record(z.string(), z.unknown()).optional(),
    scene: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.prompt.length === 0 && data.options == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prompt'],
        message: 'prompt is required when options is not provided',
      });
    }

    if (data.options != null) {
      const json = safeJsonStringify(data.options);
      if (!json) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'options must be JSON serializable',
        });
        return;
      }
      const size = utf8ByteLength(json);
      if (size > MAX_OPTIONS_JSON_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `options is too large (max ${MAX_OPTIONS_JSON_BYTES} bytes)`,
        });
      }
    }
  });

export type AiGenerateBody = z.infer<typeof AiGenerateBodySchema>;
