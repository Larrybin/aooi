# RBAC (Role-Based Access Control) Guide

This guide covers the Role-Based Access Control system for managing user permissions.

## Architecture Overview

```
src/shared/
├── services/
│   ├── rbac.ts                # Core RBAC service (server-only)
│   ├── rbac_request_cache.ts  # Request-scope permission checker cache
│   └── rbac_guard.ts          # RSC/page guards (redirect/throw)
├── lib/api/
│   └── guard.ts               # Route Handler auth + CSRF + permission guard
├── lib/action/
│   └── guard.ts          # Server Action guards
└── constants/
    └── rbac-permissions.ts  # Permission code constants

scripts/
├── init-rbac.ts          # Initialize roles & permissions
├── assign-role.ts        # Assign roles to users
└── self-check-rbac.ts    # Smoke-check RBAC schema/config
```

## Database Schema

The RBAC system uses four tables:

| Table             | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `role`            | Role definitions (name, title, status)                 |
| `permission`      | Permission definitions (code, resource, action)        |
| `role_permission` | Many-to-many: roles ↔ permissions                      |
| `user_role`       | Many-to-many: users ↔ roles (with optional expiration) |

## Built-in Roles

| Role          | Description        | Permissions            |
| ------------- | ------------------ | ---------------------- |
| `super_admin` | Full system access | `*` (all)              |
| `admin`       | Administrator      | Most admin permissions |
| `editor`      | Content editor     | Posts, categories      |
| `viewer`      | Read-only access   | View-only permissions  |

## Permission Code Format

Permissions follow a hierarchical `resource.action` pattern:

```
admin.access           # Access admin area
admin.users.read       # Read users
admin.users.write      # Create/update users
admin.users.delete     # Delete users
admin.posts.*          # All post permissions (wildcard)
*                      # All permissions (super admin)
```

### Available Permission Codes

```typescript
// src/shared/constants/rbac-permissions.ts
export const PERMISSIONS = {
  ADMIN_ACCESS: 'admin.access',

  // Users
  USERS_READ: 'admin.users.read',
  USERS_WRITE: 'admin.users.write',
  USERS_DELETE: 'admin.users.delete',

  // Posts
  POSTS_READ: 'admin.posts.read',
  POSTS_WRITE: 'admin.posts.write',
  POSTS_DELETE: 'admin.posts.delete',

  // Settings
  SETTINGS_READ: 'admin.settings.read',
  SETTINGS_WRITE: 'admin.settings.write',

  // ... more permissions
} as const;
```

## Wildcard Matching

The RBAC system supports wildcard permission matching:

```typescript
// User has permission 'admin.posts.*'
hasPermission(userId, 'admin.posts.read'); // ✓ true
hasPermission(userId, 'admin.posts.write'); // ✓ true
hasPermission(userId, 'admin.users.read'); // ✗ false

// User has permission '*' (super admin)
hasPermission(userId, 'admin.posts.read'); // ✓ true
hasPermission(userId, 'anything.here'); // ✓ true
```

## Server-Side API

### Permission Checker (Recommended)

Use `getPermissionCheckerForRequest()` to reuse permission lookups across the same request (built on React `cache()`):

```typescript
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { getPermissionCheckerForRequest } from '@/shared/services/rbac_request_cache';

// Creates a request-scoped cached checker for a user
const checker = getPermissionCheckerForRequest(userId);

// Single permission check
const canRead = await checker.has(PERMISSIONS.POSTS_READ);

// Check any of multiple permissions
const canManage = await checker.hasAny([
  PERMISSIONS.POSTS_WRITE,
  PERMISSIONS.POSTS_DELETE,
]);

// Check all permissions
const hasFullAccess = await checker.hasAll([
  PERMISSIONS.POSTS_READ,
  PERMISSIONS.POSTS_WRITE,
]);
```

### Direct Functions

```typescript
import {
  getUserPermissions,
  getUserRoles,
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
} from '@/shared/services/rbac';

// Check single permission
const allowed = await hasPermission(userId, 'admin.users.read');

// Check if user has a specific role
const isAdmin = await hasRole(userId, 'admin');

// Get all user roles
const roles = await getUserRoles(userId);

// Get all user permissions
const permissions = await getUserPermissions(userId);
```

## Guard Functions

### Server Actions

```typescript
// src/shared/lib/action/guard.ts
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import {
  requireActionAnyPermissions,
  requireActionPermission,
  requireActionPermissions,
  requireActionUser,
} from '@/shared/lib/action/guard';

// In a Server Action
export async function deletePost(postId: string) {
  const user = await requireActionUser(); // Throws if not authenticated
  await requireActionPermission(user.id, PERMISSIONS.POSTS_DELETE); // Throws if no permission

  // ... delete logic
}

// Require all permissions
await requireActionPermissions(
  userId,
  PERMISSIONS.POSTS_READ,
  PERMISSIONS.POSTS_WRITE
);

// Require any of the permissions
await requireActionAnyPermissions(
  userId,
  PERMISSIONS.POSTS_WRITE,
  PERMISSIONS.POSTS_DELETE
);
```

### Route Handlers

```typescript
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { requirePermission, requireUser } from '@/shared/lib/api/guard';

export const GET = withApi(async (req: Request) => {
  const user = await requireUser(req);

  await requirePermission(user.id, PERMISSIONS.USERS_READ);

  // ... handler logic
});
```

## Role Management API

### Create Role

```typescript
import { createRole, NewRole } from '@/shared/services/rbac';

const newRole: NewRole = {
  id: getUuid(),
  name: 'moderator',
  title: 'Moderator',
  description: 'Content moderation role',
  status: 'active',
  sort: 5,
};

const role = await createRole(newRole);
```

### Assign Permissions to Role

```typescript
import {
  assignPermissionsToRole,
  getPermissionByCode,
} from '@/shared/services/rbac';

// Get permission IDs
const readPerm = await getPermissionByCode('admin.posts.read');
const writePerm = await getPermissionByCode('admin.posts.write');

// Assign permissions (replaces existing)
await assignPermissionsToRole(roleId, [readPerm.id, writePerm.id]);
```

### Assign Role to User

```typescript
import { assignRolesToUser, assignRoleToUser } from '@/shared/services/rbac';

// Assign single role
await assignRoleToUser(userId, roleId);

// Assign multiple roles (replaces existing)
await assignRolesToUser(userId, [roleId1, roleId2]);
```

## Initialization Scripts

### Initialize RBAC System

Run this script to create default roles and permissions:

```bash
npx tsx scripts/init-rbac.ts
```

### Assign Super Admin Role

```bash
npx tsx scripts/init-rbac.ts --admin-email=admin@example.com
```

### Assign Role to User

```bash
npx tsx scripts/assign-role.ts --email=user@example.com --role=editor
```

## Role Expiration

User roles can have an expiration date:

```typescript
import { assignRoleToUser } from '@/shared/services/rbac';

// Role expires in 30 days
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30);

await assignRoleToUser(userId, roleId, expiresAt);
```

Expired roles are automatically excluded from permission checks.

## Soft Delete

Roles support soft delete via `deleted_at` column:

```typescript
import { deleteRole } from '@/shared/services/rbac';

// Soft deletes the role
await deleteRole(roleId);
```

Soft-deleted roles are excluded from all queries.

## Error Handling

The RBAC system includes schema validation. If the `role.deleted_at` column is missing (e.g., migrations not applied), you'll see:

```
Database schema mismatch: missing column public.role.deleted_at.
This usually means migrations were not applied.
Run: pnpm db:migrate
```

## Best Practices

1. **Use permission constants** - Import from `@/shared/constants/rbac-permissions.ts`
2. **Use createPermissionChecker** - For multiple permission checks in one request
3. **Guard at the entry point** - Check permissions at Route Handler/Server Action entry
4. **Don't trust client-side checks** - Always verify permissions server-side
5. **Use granular permissions** - Prefer specific codes over wildcards for regular roles

## Related Files

- `src/shared/services/rbac.ts` - Core RBAC service
- `src/shared/lib/action/guard.ts` - Server Action guards
- `src/shared/constants/rbac-permissions.ts` - Permission constants
- `src/config/db/schema.ts` - Database schema definitions
- `scripts/init-rbac.ts` - Initialization script
- `scripts/assign-role.ts` - Role assignment script
