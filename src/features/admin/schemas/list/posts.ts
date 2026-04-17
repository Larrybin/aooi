import type { z } from 'zod';

import { adminPaginationQuerySchema } from './common';

export const AdminPostsListQuerySchema = adminPaginationQuerySchema;

export type AdminPostsListQuery = z.infer<typeof AdminPostsListQuerySchema>;
