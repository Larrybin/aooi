import type { z } from 'zod';

import {
  adminPaginationQuerySchema,
  createOptionalEnumQuerySchema,
} from './common';

export const AdminSubscriptionsListQuerySchema =
  adminPaginationQuerySchema.extend({
    interval: createOptionalEnumQuerySchema(['month', 'year']),
  });

export type AdminSubscriptionsListQuery = z.infer<
  typeof AdminSubscriptionsListQuerySchema
>;
