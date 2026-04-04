import { z } from 'zod';

import {
  nonEmptyTrimmedStringSchema,
  optionalTrimmedStringSchema,
} from '@/shared/schemas/actions/common';

export const AdminPostFormSchema = z.object({
  slug: nonEmptyTrimmedStringSchema,
  title: nonEmptyTrimmedStringSchema,
  description: optionalTrimmedStringSchema,
  content: optionalTrimmedStringSchema,
  categories: optionalTrimmedStringSchema,
  image: optionalTrimmedStringSchema,
  authorName: optionalTrimmedStringSchema,
  authorImage: optionalTrimmedStringSchema,
});
