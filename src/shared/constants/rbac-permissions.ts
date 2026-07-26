export const PERMISSIONS = {
  // Admin access
  ADMIN_ACCESS: 'admin.access',

  // Users
  USERS_READ: 'admin.users.read',
  USERS_WRITE: 'admin.users.write',
  USERS_DELETE: 'admin.users.delete',

  // Posts
  POSTS_READ: 'admin.posts.read',
  POSTS_WRITE: 'admin.posts.write',
  POSTS_DELETE: 'admin.posts.delete',

  // Categories
  CATEGORIES_READ: 'admin.categories.read',
  CATEGORIES_WRITE: 'admin.categories.write',
  CATEGORIES_DELETE: 'admin.categories.delete',

  // Payments
  PAYMENTS_READ: 'admin.payments.read',
  PAYMENTS_WRITE: 'admin.payments.write',

  // Subscriptions
  SUBSCRIPTIONS_READ: 'admin.subscriptions.read',

  // Credits
  CREDITS_READ: 'admin.credits.read',
  CREDITS_WRITE: 'admin.credits.write',

  // API Keys
  APIKEYS_READ: 'admin.apikeys.read',
  APIKEYS_WRITE: 'admin.apikeys.write',
  APIKEYS_DELETE: 'admin.apikeys.delete',

  // Settings
  SETTINGS_READ: 'admin.settings.read',
  SETTINGS_WRITE: 'admin.settings.write',

  // Roles & Permissions
  ROLES_READ: 'admin.roles.read',
  ROLES_WRITE: 'admin.roles.write',
  ROLES_DELETE: 'admin.roles.delete',

  // Email
  EMAIL_TEST: 'admin.email.test',

  PERMISSIONS_READ: 'admin.permissions.read',
  PERMISSIONS_WRITE: 'admin.permissions.write',
  PERMISSIONS_DELETE: 'admin.permissions.delete',

  // AI Tasks
  AITASKS_READ: 'admin.ai-tasks.read',
  AITASKS_WRITE: 'admin.ai-tasks.write',
  AITASKS_DELETE: 'admin.ai-tasks.delete',
} as const;

/**
 * Permissions that exist as grantable codes but have no enforcement point,
 * because the operation they describe has not been built yet.
 *
 * Nothing is under-protected by this - there is no delete action for users,
 * posts or categories, and the apikeys / credits / ai-tasks / permissions admin
 * sections are read-only list pages. The hazard is the other way round: an
 * administrator can grant `admin.users.delete` and reasonably believe they have
 * conferred a capability, and a reviewer auditing a role sees permissions that
 * do not correspond to anything real.
 *
 * Every entry here is a promise to enforce the code when the matching operation
 * lands. `rbac-permissions.test.ts` fails if a code outside this list loses its
 * last enforcement point, so the set cannot grow silently.
 */
export const RESERVED_UNENFORCED_PERMISSIONS: readonly string[] = [
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.POSTS_DELETE,
  PERMISSIONS.CATEGORIES_DELETE,
  PERMISSIONS.CREDITS_WRITE,
  PERMISSIONS.APIKEYS_WRITE,
  PERMISSIONS.APIKEYS_DELETE,
  PERMISSIONS.PERMISSIONS_WRITE,
  PERMISSIONS.PERMISSIONS_DELETE,
  PERMISSIONS.AITASKS_WRITE,
  PERMISSIONS.AITASKS_DELETE,
];
