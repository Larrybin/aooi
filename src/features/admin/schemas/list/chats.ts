import type { z } from 'zod';

import { adminPaginationQuerySchema } from './common';

export const AdminChatsListQuerySchema = adminPaginationQuerySchema;

export type AdminChatsListQuery = z.infer<typeof AdminChatsListQuerySchema>;
