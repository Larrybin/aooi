import { z } from 'zod';

export const nonEmptyTrimmedStringSchema = z.string().trim().min(1);

export const optionalTrimmedStringSchema = z
  .string()
  .transform((value) => value.trim())
  .optional();
