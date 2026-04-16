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
