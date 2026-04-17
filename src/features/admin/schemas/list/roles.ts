import { z } from 'zod';

import { booleanFlagQuerySchema } from './common';

export const AdminRolesListQuerySchema = z.object({
  includeDeleted: booleanFlagQuerySchema,
});

export type AdminRolesListQuery = z.infer<typeof AdminRolesListQuerySchema>;
