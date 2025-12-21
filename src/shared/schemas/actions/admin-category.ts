import { z } from 'zod';

import {
  nonEmptyTrimmedStringSchema,
  optionalTrimmedStringSchema,
} from './common';

export const AdminCategoryFormSchema = z.object({
  slug: nonEmptyTrimmedStringSchema,
  title: nonEmptyTrimmedStringSchema,
  description: optionalTrimmedStringSchema,
});
