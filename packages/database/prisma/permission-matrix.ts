// Elenco autoritativo dei permessi e mappa ruolo->permessi usata dal seed.
// Deve restare coerente con apps/api/src/common/permissions.ts

export const ALL_PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: 'org.manage', description: 'Gestire le proprietà dell\'organizzazione' },
  { key: 'users.create', description: 'Creare nuovi utenti' },
  { key: 'users.manage', description: 'Modificare, sospendere, disattivare utenti' },
  { key: 'users.suspend', description: 'Sospendere o eliminare utenti' },
  { key: 'roles.manage', description: 'Creare e modificare ruoli e permessi' },
  { key: 'creators.view', description: 'Visualizzare le creator' },
  { key: 'creators.manage', description: 'Creare e modificare le creator' },
  { key: 'creators.assign', description: 'Assegnare team alle creator' },
  { key: 'accounts.connect', description: 'Collegare account OnlyFans' },
  { key: 'accounts.disconnect', description: 'Scollegare account OnlyFans' },
  { key: 'accounts.view_secrets', description: 'Visualizzare credenziali/secret dei provider' },
  { key: 'fans.view', description: 'Visualizzare i fan' },
  { key: 'fans.manage', description: 'Modificare, assegnare, taggare i fan' },
  { key: 'messages.view', description: 'Visualizzare le conversazioni' },
  { key: 'messages.send', description: 'Inviare messaggi' },
  { key: 'ai.configure', description: 'Configurare i profili AI delle creator' },
  { key: 'ai.use', description: 'Utilizzare suggerimenti AI' },
  { key: 'analytics.view', description: 'Visualizzare statistiche del proprio team' },
  { key: 'analytics.view_all', description: 'Visualizzare statistiche di tutta l\'organizzazione' },
  { key: 'finance.view', description: 'Visualizzare dati finanziari' },
  { key: 'finance.manage', description: 'Modificare commissioni e configurazioni finanziarie' },
  { key: 'shifts.manage', description: 'Gestire turni del team' },
  { key: 'shifts.use', description: 'Iniziare/terminare il proprio turno' },
  { key: 'media.view', description: 'Visualizzare il Media Vault' },
  { key: 'media.manage', description: 'Caricare e gestire media' },
  { key: 'automations.manage', description: 'Creare e modificare automazioni' },
  { key: 'notifications.manage', description: 'Gestire le notifiche' },
  { key: 'audit.view', description: 'Consultare l\'audit log' },
  { key: 'settings.manage', description: 'Modificare impostazioni critiche di sicurezza' },
  { key: 'api_keys.manage', description: 'Gestire le API key dell\'organizzazione' },
];

export const ROLE_DEFINITIONS: Array<{
  key: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}> = [
  {
    key: 'OWNER',
    name: 'Owner',
    isSystem: true,
    permissions: ALL_PERMISSIONS.map((p) => p.key), // accesso completo
  },
  {
    key: 'ADMIN',
    name: 'Amministratore',
    isSystem: true,
    permissions: [
      'users.create',
      'users.manage',
      'creators.view',
      'creators.manage',
      'creators.assign',
      'accounts.connect',
      'accounts.disconnect',
      'fans.view',
      'fans.manage',
      'messages.view',
      'messages.send',
      'ai.use',
      'ai.configure',
      'analytics.view',
      'analytics.view_all',
      'shifts.manage',
      'media.view',
      'media.manage',
      'automations.manage',
      'notifications.manage',
      'audit.view',
    ],
  },
  {
    key: 'CHATTER_MANAGER',
    name: 'Chatter Manager',
    isSystem: true,
    permissions: [
      'creators.view',
      'fans.view',
      'fans.manage',
      'messages.view',
      'messages.send',
      'ai.use',
      'analytics.view',
      'shifts.manage',
      'shifts.use',
      'media.view',
    ],
  },
  {
    key: 'CHATTER',
    name: 'Chatter',
    isSystem: true,
    permissions: [
      'creators.view',
      'fans.view',
      'messages.view',
      'messages.send',
      'ai.use',
      'shifts.use',
      'media.view',
      'analytics.view',
    ],
  },
];
