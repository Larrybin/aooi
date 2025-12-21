import { z } from 'zod';

import { nonEmptyTrimmedStringSchema } from './common';

export const AdminRoleUpdateFormSchema = z.object({
  title: nonEmptyTrimmedStringSchema,
  description: nonEmptyTrimmedStringSchema,
});
