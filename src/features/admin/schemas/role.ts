import { z } from 'zod';

import { nonEmptyTrimmedStringSchema } from '@/shared/schemas/actions/common';

export const AdminRoleUpdateFormSchema = z.object({
  title: nonEmptyTrimmedStringSchema,
  description: nonEmptyTrimmedStringSchema,
});
