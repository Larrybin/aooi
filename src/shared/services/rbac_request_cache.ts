import 'server-only';

import { cache } from 'react';

import { createRbacChecker } from '@/core/rbac';

export const getPermissionCheckerForRequest = cache((userId: string) =>
  createRbacChecker(userId)
);
