import { z } from 'zod';

import {
  nonEmptyTrimmedStringSchema,
  optionalTrimmedStringSchema,
} from '@/shared/schemas/actions/common';

export const AdminCategoryFormSchema = z.object({
  slug: nonEmptyTrimmedStringSchema,
  title: nonEmptyTrimmedStringSchema,
  description: optionalTrimmedStringSchema,
});
