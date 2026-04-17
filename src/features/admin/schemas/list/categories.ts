import type { z } from 'zod';

import { adminPaginationQuerySchema } from './common';

export const AdminCategoriesListQuerySchema = adminPaginationQuerySchema;

export type AdminCategoriesListQuery = z.infer<
  typeof AdminCategoriesListQuerySchema
>;
