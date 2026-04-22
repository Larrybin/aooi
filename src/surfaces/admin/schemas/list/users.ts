import type { z } from 'zod';

import {
  adminPaginationQuerySchema,
  optionalTrimmedQueryStringSchema,
} from './common';

export const AdminUsersListQuerySchema = adminPaginationQuerySchema.extend({
  email: optionalTrimmedQueryStringSchema,
});

export type AdminUsersListQuery = z.infer<typeof AdminUsersListQuerySchema>;
