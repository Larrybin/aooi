import type { z } from 'zod';

import { adminPaginationQuerySchema } from './common';

export const AdminApikeysListQuerySchema = adminPaginationQuerySchema;

export type AdminApikeysListQuery = z.infer<typeof AdminApikeysListQuerySchema>;
