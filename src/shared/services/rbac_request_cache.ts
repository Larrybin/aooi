import 'server-only';

import { cache } from 'react';

import { createPermissionChecker } from '@/core/rbac';

export const getPermissionCheckerForRequest = cache((userId: string) =>
  createPermissionChecker(userId)
);
