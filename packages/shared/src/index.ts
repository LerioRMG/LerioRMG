// Costanti condivise tra frontend (apps/web) e riferimento per il backend.
// Il backend (apps/api) mantiene la propria copia autoritativa in src/common/permissions.ts
// per evitare dipendenze di build incrociate tra Nest e Next in un monorepo npm workspaces "puro".

export const SYSTEM_ROLES = [
  'OWNER',
  'ADMIN',
  'CHATTER_MANAGER',
  'CHATTER',
  'FINANCE',
  'ANALYST',
  'VIEWER',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ROLE_LABELS_IT: Record<SystemRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Amministratore',
  CHATTER_MANAGER: 'Chatter Manager',
  CHATTER: 'Chatter',
  FINANCE: 'Finance',
  ANALYST: 'Analyst',
  VIEWER: 'Viewer',
};

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

export const PROVIDER_KEYS = [
  'manual',
  'csv_import',
  'provider_api_1',
  'provider_api_2',
] as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export const PROVIDER_LABELS_IT: Record<ProviderKey, string> = {
  manual: 'Modalità manuale',
  csv_import: 'Importazione CSV',
  provider_api_1: 'Provider API 1 (esterno)',
  provider_api_2: 'Provider API 2 (esterno)',
};

export const SIDEBAR_ITEMS_IT = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'messages', label: 'Messages Pro', path: '/messages' },
  { key: 'creators', label: 'Creator', path: '/creators' },
  { key: 'accounts', label: 'Account', path: '/accounts' },
  { key: 'fans', label: 'Fan', path: '/fans' },
  { key: 'ai', label: 'AI', path: '/ai' },
  { key: 'analytics', label: 'Analytics', path: '/analytics' },
  { key: 'team', label: 'Team', path: '/team' },
  { key: 'shifts', label: 'Turni', path: '/shifts' },
  { key: 'media', label: 'Media Vault', path: '/media' },
  { key: 'automations', label: 'Automazioni', path: '/automations' },
  { key: 'finance', label: 'Finanze', path: '/finance' },
  { key: 'notifications', label: 'Notifiche', path: '/notifications' },
  { key: 'audit', label: 'Audit Log', path: '/audit' },
  { key: 'settings', label: 'Impostazioni', path: '/settings' },
] as const;
