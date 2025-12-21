import 'server-only';

import type { z } from 'zod';

import { parseFormData } from '@/shared/lib/action/form';
import {
  requireActionPermission,
  requireActionUser,
  type PermissionCode,
} from '@/shared/lib/action/guard';

type User = Awaited<ReturnType<typeof requireActionUser>>;

/**
 * Validate user permission and parse form data
 *
 * Note: This is NOT a Server Action. It's a helper function to be called inside Server Actions.
 *
 * @example
 * ```ts
 * // In your actions.ts file:
 * 'use server'
 * export async function createCategoryAction(formData: FormData) {
 *   return withAction(async () => {
 *     const { user, data } = await validateAndParseForm({
 *       formData,
 *       permission: PERMISSIONS.CATEGORIES_WRITE,
 *       schema: AdminCategoryFormSchema,
 *       errorMessage: 'slug and title are required',
 *     });
 *     // ... use user and data
 *   });
 * }
 * ```
 */
export async function validateAndParseForm<T extends z.ZodSchema>({
  formData,
  permission,
  schema,
  errorMessage,
}: {
  formData: FormData;
  permission: PermissionCode;
  schema: T;
  errorMessage: string;
}): Promise<{ user: User; data: z.infer<T> }> {
  const user = await requireActionUser();
  await requireActionPermission(user.id, permission);
  const data = parseFormData(formData, schema, { message: errorMessage });
  return { user, data };
}

/**
 * Validate user permission only (for actions that don't need form parsing)
 */
export async function validatePermission(
  permission: PermissionCode
): Promise<User> {
  const user = await requireActionUser();
  await requireActionPermission(user.id, permission);
  return user;
}
