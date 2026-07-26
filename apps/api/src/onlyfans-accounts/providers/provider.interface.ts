export interface ConnectAccountInput {
  username: string;
  displayName: string;
  apiKey?: string;
  apiSecret?: string;
  profileUrl?: string;
}

export interface ConnectionCheckResult {
  connected: boolean;
  message: string;
}

export interface SyncResult {
  status: 'success' | 'failed' | 'not_configured';
  message: string;
  importedCount?: number;
}

export interface SendMessageInput {
  fanExternalId: string;
  body: string;
  price?: number;
}

export interface AnalyticsSnapshot {
  status: 'success' | 'not_configured';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Contratto che ogni provider OnlyFans deve implementare. Il CRM non dipende da un
 * singolo servizio esterno: nuovi provider si aggiungono implementando questa interfaccia
 * e registrandoli in ProviderRegistryService, senza toccare il resto dell'applicazione.
 */
export interface OnlyFansProvider {
  readonly key: string;
  readonly label: string;

  /** true se le variabili d'ambiente/credenziali necessarie sono presenti */
  isConfigured(): boolean;

  connectAccount(input: ConnectAccountInput): Promise<{ externalAccountId?: string; message: string }>;
  disconnectAccount(externalAccountId: string | null): Promise<{ message: string }>;

  syncProfile(externalAccountId: string | null): Promise<SyncResult>;
  syncFans(externalAccountId: string | null): Promise<SyncResult>;
  syncMessages(externalAccountId: string | null): Promise<SyncResult>;
  syncTransactions(externalAccountId: string | null): Promise<SyncResult>;
  syncSubscriptions(externalAccountId: string | null): Promise<SyncResult>;

  sendMessage(externalAccountId: string | null, input: SendMessageInput): Promise<SyncResult>;
  sendMedia(externalAccountId: string | null, mediaUrl: string): Promise<SyncResult>;

  getAnalytics(externalAccountId: string | null): Promise<AnalyticsSnapshot>;
  refreshCredentials(externalAccountId: string | null): Promise<{ message: string }>;
  checkConnection(externalAccountId: string | null): Promise<ConnectionCheckResult>;
}
