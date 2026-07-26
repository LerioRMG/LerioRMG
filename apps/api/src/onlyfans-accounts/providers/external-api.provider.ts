import { Logger } from '@nestjs/common';
import {
  AnalyticsSnapshot,
  ConnectAccountInput,
  ConnectionCheckResult,
  OnlyFansProvider,
  SendMessageInput,
  SyncResult,
} from './provider.interface';

export interface ExternalApiProviderConfig {
  key: string;
  label: string;
  baseUrl?: string;
  apiKey?: string;
  envVarBaseUrl: string;
  envVarApiKey: string;
}

/**
 * Provider per un connettore API esterno reale e configurabile (provider_api_1 / provider_api_2).
 * Il CRM non implementa un client proprietario del sito OnlyFans: si appoggia a un connettore
 * compatibile esposto su PROVIDER_API_x_BASE_URL con autenticazione Bearer PROVIDER_API_x_API_KEY,
 * seguendo convenzioni REST standard (POST /accounts, /accounts/:id/sync-fans, ecc.).
 *
 * Se le variabili d'ambiente non sono configurate, il provider dichiara esplicitamente
 * "Provider non configurato" invece di simulare una connessione attiva.
 */
export class ExternalApiProvider implements OnlyFansProvider {
  readonly key: string;
  readonly label: string;
  private readonly logger: Logger;

  constructor(private readonly cfg: ExternalApiProviderConfig) {
    this.key = cfg.key;
    this.label = cfg.label;
    this.logger = new Logger(`Provider:${cfg.key}`);
  }

  isConfigured(): boolean {
    return Boolean(this.cfg.baseUrl && this.cfg.apiKey);
  }

  private notConfiguredMessage(): string {
    return (
      'Provider non configurato. Imposta le variabili d\'ambiente ' +
      `${this.cfg.envVarBaseUrl} e ${this.cfg.envVarApiKey} per attivare "${this.cfg.label}".`
    );
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.isConfigured()) {
      throw new Error(this.notConfiguredMessage());
    }
    const url = `${this.cfg.baseUrl!.replace(/\/$/, '')}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
        ...(init.headers || {}),
      },
    });
  }

  async connectAccount(input: ConnectAccountInput) {
    if (!this.isConfigured()) {
      return { message: this.notConfiguredMessage() };
    }
    try {
      const res = await this.request('/accounts/connect', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Risposta provider non valida (HTTP ${res.status})`);
      const body = (await res.json()) as { externalAccountId?: string };
      return { externalAccountId: body.externalAccountId, message: 'Account collegato tramite provider esterno.' };
    } catch (error) {
      this.logger.error(error);
      return { message: `Connessione al provider fallita: ${(error as Error).message}` };
    }
  }

  async disconnectAccount(externalAccountId: string | null) {
    if (!this.isConfigured()) return { message: this.notConfiguredMessage() };
    try {
      await this.request(`/accounts/${externalAccountId}/disconnect`, { method: 'POST' });
      return { message: 'Account scollegato dal provider esterno.' };
    } catch (error) {
      return { message: `Scollegamento fallito: ${(error as Error).message}` };
    }
  }

  private async syncOperation(path: string, label: string, externalAccountId: string | null): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return { status: 'not_configured', message: this.notConfiguredMessage() };
    }
    try {
      const res = await this.request(`/accounts/${externalAccountId}${path}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json().catch(() => ({}))) as { importedCount?: number };
      return { status: 'success', message: `${label} completata.`, importedCount: body.importedCount };
    } catch (error) {
      return { status: 'failed', message: `${label} fallita: ${(error as Error).message}` };
    }
  }

  syncProfile = (externalAccountId: string | null) =>
    this.syncOperation('/sync-profile', 'Sincronizzazione profilo', externalAccountId);
  syncFans = (externalAccountId: string | null) =>
    this.syncOperation('/sync-fans', 'Sincronizzazione fan', externalAccountId);
  syncMessages = (externalAccountId: string | null) =>
    this.syncOperation('/sync-messages', 'Sincronizzazione messaggi', externalAccountId);
  syncTransactions = (externalAccountId: string | null) =>
    this.syncOperation('/sync-transactions', 'Sincronizzazione transazioni', externalAccountId);
  syncSubscriptions = (externalAccountId: string | null) =>
    this.syncOperation('/sync-subscriptions', 'Sincronizzazione abbonamenti', externalAccountId);

  async sendMessage(externalAccountId: string | null, input: SendMessageInput): Promise<SyncResult> {
    if (!this.isConfigured()) return { status: 'not_configured', message: this.notConfiguredMessage() };
    try {
      const res = await this.request(`/accounts/${externalAccountId}/messages`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: 'success', message: 'Messaggio inviato tramite provider esterno.' };
    } catch (error) {
      return { status: 'failed', message: `Invio fallito: ${(error as Error).message}` };
    }
  }

  async sendMedia(externalAccountId: string | null, mediaUrl: string): Promise<SyncResult> {
    if (!this.isConfigured()) return { status: 'not_configured', message: this.notConfiguredMessage() };
    try {
      const res = await this.request(`/accounts/${externalAccountId}/media`, {
        method: 'POST',
        body: JSON.stringify({ mediaUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: 'success', message: 'Media inviato tramite provider esterno.' };
    } catch (error) {
      return { status: 'failed', message: `Invio media fallito: ${(error as Error).message}` };
    }
  }

  async getAnalytics(externalAccountId: string | null): Promise<AnalyticsSnapshot> {
    if (!this.isConfigured()) return { status: 'not_configured', message: this.notConfiguredMessage() };
    try {
      const res = await this.request(`/accounts/${externalAccountId}/analytics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { status: 'success', message: 'Statistiche recuperate dal provider.', data };
    } catch (error) {
      return { status: 'not_configured', message: `Recupero statistiche fallito: ${(error as Error).message}` };
    }
  }

  async refreshCredentials(externalAccountId: string | null) {
    if (!this.isConfigured()) return { message: this.notConfiguredMessage() };
    try {
      await this.request(`/accounts/${externalAccountId}/refresh-credentials`, { method: 'POST' });
      return { message: 'Credenziali aggiornate.' };
    } catch (error) {
      return { message: `Aggiornamento credenziali fallito: ${(error as Error).message}` };
    }
  }

  async checkConnection(externalAccountId: string | null): Promise<ConnectionCheckResult> {
    if (!this.isConfigured()) {
      return { connected: false, message: this.notConfiguredMessage() };
    }
    try {
      const res = await this.request(`/accounts/${externalAccountId}/status`);
      return { connected: res.ok, message: res.ok ? 'Connesso.' : `Provider ha risposto HTTP ${res.status}.` };
    } catch (error) {
      return { connected: false, message: `Impossibile raggiungere il provider: ${(error as Error).message}` };
    }
  }
}
