import { z } from 'zod';

import {
  nonEmptyTrimmedStringSchema,
  optionalTrimmedStringSchema,
} from './common';

export const AdminUserUpdateFormSchema = z.object({
  name: nonEmptyTrimmedStringSchema,
  image: optionalTrimmedStringSchema,
});
