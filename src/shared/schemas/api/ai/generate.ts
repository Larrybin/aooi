/**
 * Usage: `parseJson(req, AiGenerateBodySchema)`
 */

import { z } from 'zod';

import { AIMediaType } from '@/extensions/ai';

export const AiGenerateBodySchema = z
  .object({
    provider: z.string().min(1),
    mediaType: z.nativeEnum(AIMediaType),
    model: z.string().min(1),
    prompt: z.string().optional().default(''),
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
  });

export type AiGenerateBody = z.infer<typeof AiGenerateBodySchema>;
