import { z } from 'zod';

import {
  adminPaginationQuerySchema,
  createOptionalEnumQuerySchema,
  optionalTrimmedQueryStringSchema,
} from './common';
import {
  ADMIN_PAYMENT_PROVIDERS,
  ADMIN_PAYMENT_STATUSES,
  ADMIN_PAYMENT_TYPES,
} from './query-options';

export const AdminPaymentsListQuerySchema = adminPaginationQuerySchema.extend({
  type: createOptionalEnumQuerySchema(ADMIN_PAYMENT_TYPES),
  status: createOptionalEnumQuerySchema(ADMIN_PAYMENT_STATUSES),
  provider: createOptionalEnumQuerySchema(ADMIN_PAYMENT_PROVIDERS),
  orderNo: optionalTrimmedQueryStringSchema,
});

export type AdminPaymentsListQuery = z.infer<typeof AdminPaymentsListQuerySchema>;
