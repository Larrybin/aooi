import { z } from 'zod';

export const AdminPermissionsListQuerySchema = z.object({});

export type AdminPermissionsListQuery = z.infer<
  typeof AdminPermissionsListQuerySchema
>;
