// Copia autoritativa lato backend, deve restare coerente con
// packages/database/prisma/permission-matrix.ts

export const PERMISSIONS = [
  'org.manage',
  'users.create',
  'users.manage',
  'users.suspend',
  'roles.manage',
  'creators.view',
  'creators.manage',
  'creators.assign',
  'accounts.connect',
  'accounts.disconnect',
  'accounts.view_secrets',
  'fans.view',
  'fans.manage',
  'messages.view',
  'messages.send',
  'ai.configure',
  'ai.use',
  'analytics.view',
  'analytics.view_all',
  'finance.view',
  'finance.manage',
  'shifts.manage',
  'shifts.use',
  'media.view',
  'media.manage',
  'automations.manage',
  'notifications.manage',
  'audit.view',
  'settings.manage',
  'api_keys.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
