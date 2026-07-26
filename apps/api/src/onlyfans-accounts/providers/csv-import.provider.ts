import { Injectable } from '@nestjs/common';
import {
  AnalyticsSnapshot,
  ConnectAccountInput,
  ConnectionCheckResult,
  OnlyFansProvider,
  SendMessageInput,
  SyncResult,
} from './provider.interface';

/**
 * Provider basato su importazione CSV reale (vedi CsvImportService e l'endpoint
 * POST /onlyfans-accounts/:id/import-csv). Non simula dati: senza un file caricato
 * non ci sono fan/transazioni importati.
 */
@Injectable()
export class CsvImportProvider implements OnlyFansProvider {
  readonly key = 'CSV_IMPORT';
  readonly label = 'Importazione CSV';

  isConfigured(): boolean {
    return true;
  }

  async connectAccount(input: ConnectAccountInput) {
    return {
      message: `Account "${input.username}" pronto per importazione CSV. Carica un file da Impostazioni > Account.`,
    };
  }

  async disconnectAccount() {
    return { message: 'Account scollegato.' };
  }

  private notice(operation: string): SyncResult {
    return {
      status: 'success',
      message: `${operation}: usa l'endpoint di importazione CSV dedicato per caricare un export reale.`,
    };
  }

  syncProfile = async () => this.notice('Sincronizzazione profilo');
  syncFans = async () => this.notice('Sincronizzazione fan');
  syncMessages = async () => this.notice('Sincronizzazione messaggi');
  syncTransactions = async () => this.notice('Sincronizzazione transazioni');
  syncSubscriptions = async () => this.notice('Sincronizzazione abbonamenti');

  async sendMessage(_externalAccountId: string | null, _input: SendMessageInput): Promise<SyncResult> {
    return {
      status: 'failed',
      message: "L'invio messaggi non è disponibile per il provider CSV (solo importazione dati storici).",
    };
  }

  async sendMedia(): Promise<SyncResult> {
    return { status: 'failed', message: 'Invio media non disponibile per il provider CSV.' };
  }

  async getAnalytics(): Promise<AnalyticsSnapshot> {
    return { status: 'success', message: 'Statistiche calcolate sui dati importati da CSV.' };
  }

  async refreshCredentials() {
    return { message: 'Nessuna credenziale da aggiornare per il provider CSV.' };
  }

  async checkConnection(): Promise<ConnectionCheckResult> {
    return { connected: true, message: 'Provider CSV pronto a ricevere import.' };
  }
}
