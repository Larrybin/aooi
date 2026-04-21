import type { z } from 'zod';

import {
  adminPaginationQuerySchema,
  createOptionalEnumQuerySchema,
} from './common';
import { ADMIN_CREDIT_TRANSACTION_TYPES } from './query-options';

export const AdminCreditsListQuerySchema = adminPaginationQuerySchema.extend({
  type: createOptionalEnumQuerySchema(ADMIN_CREDIT_TRANSACTION_TYPES),
});

export type AdminCreditsListQuery = z.infer<typeof AdminCreditsListQuerySchema>;
