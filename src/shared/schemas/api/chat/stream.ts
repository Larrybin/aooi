import { z } from 'zod';

import { CHAT_ALLOWED_MODELS } from '@/shared/constants/chat-model-policy';
import { safeJsonStringify, utf8ByteLength } from '@/shared/lib/utf8';

const MAX_CHAT_MESSAGE_JSON_BYTES = 64 * 1024;
const MAX_CHAT_MESSAGE_PARTS = 20;
const MAX_CHAT_TEXT_PART_CHARS = 8000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const ChatStreamMessageSchema = z.unknown().superRefine((value, ctx) => {
  const json = safeJsonStringify(value);
  if (!json) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'invalid message',
    });
    return;
  }

  if (utf8ByteLength(json) > MAX_CHAT_MESSAGE_JSON_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `message is too large (max ${MAX_CHAT_MESSAGE_JSON_BYTES} bytes)`,
    });
    return;
  }

  if (!isRecord(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'invalid message',
    });
    return;
  }

  const parts = value.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'invalid message',
    });
    return;
  }

  if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `too many message parts (max ${MAX_CHAT_MESSAGE_PARTS})`,
    });
  }

  for (const part of parts) {
    if (!isRecord(part)) continue;
    const type = part.type;
    if (type !== 'text' && type !== 'reasoning') continue;

    const text = part.text;
    if (typeof text !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalid message',
      });
      return;
    }
    if (text.length > MAX_CHAT_TEXT_PART_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `message text part is too large (max ${MAX_CHAT_TEXT_PART_CHARS} chars)`,
      });
      return;
    }
  }
});

export const ChatStreamBodySchema = z.object({
  chatId: z.string().min(1),
  message: ChatStreamMessageSchema,
  model: z.enum(CHAT_ALLOWED_MODELS),
  webSearch: z.boolean().optional().default(false),
  reasoning: z.boolean().optional(),
});

export type ChatStreamBody = z.infer<typeof ChatStreamBodySchema>;
