import type { z } from 'zod';

import {
  adminPaginationQuerySchema,
  createOptionalEnumQuerySchema,
} from './common';
import { ADMIN_AI_TASK_MEDIA_TYPES } from './query-options';

export const AdminAiTasksListQuerySchema = adminPaginationQuerySchema.extend({
  type: createOptionalEnumQuerySchema(ADMIN_AI_TASK_MEDIA_TYPES),
});

export type AdminAiTasksListQuery = z.infer<typeof AdminAiTasksListQuerySchema>;
