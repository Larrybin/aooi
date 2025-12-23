import 'server-only';

import { cache } from 'react';

import { createPermissionChecker } from '@/shared/services/rbac';

export const getPermissionCheckerForRequest = cache((userId: string) =>
  createPermissionChecker(userId)
);
