import { z } from 'zod';

import {
  nonEmptyTrimmedStringSchema,
  optionalTrimmedStringSchema,
} from '@/shared/schemas/actions/common';

export const AdminUserUpdateFormSchema = z.object({
  name: nonEmptyTrimmedStringSchema,
  image: optionalTrimmedStringSchema,
});
