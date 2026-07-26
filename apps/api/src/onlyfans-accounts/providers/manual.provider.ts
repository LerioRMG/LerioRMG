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
 * Modalità manuale: nessuna integrazione esterna. Il collegamento è "attivo" nel senso
 * che l'agenzia gestisce manualmente i dati tramite le pagine del CRM (fan, transazioni,
 * conversazioni inserite a mano). Non viene simulata alcuna sincronizzazione automatica.
 */
@Injectable()
export class ManualProvider implements OnlyFansProvider {
  readonly key = 'MANUAL';
  readonly label = 'Modalità manuale';

  isConfigured(): boolean {
    return true;
  }

  async connectAccount(input: ConnectAccountInput) {
    return { message: `Account "${input.username}" collegato in modalità manuale.` };
  }

  async disconnectAccount() {
    return { message: 'Account scollegato.' };
  }

  private manualResult(operation: string): SyncResult {
    return {
      status: 'success',
      message: `${operation}: modalità manuale, nessun import automatico. Inserisci i dati dalle apposite pagine del CRM.`,
    };
  }

  syncProfile = async () => this.manualResult('Sincronizzazione profilo');
  syncFans = async () => this.manualResult('Sincronizzazione fan');
  syncMessages = async () => this.manualResult('Sincronizzazione messaggi');
  syncTransactions = async () => this.manualResult('Sincronizzazione transazioni');
  syncSubscriptions = async () => this.manualResult('Sincronizzazione abbonamenti');

  async sendMessage(_externalAccountId: string | null, input: SendMessageInput): Promise<SyncResult> {
    return {
      status: 'success',
      message: `Messaggio salvato per l'invio manuale a ${input.fanExternalId} (nessun invio reale su OnlyFans in modalità manuale).`,
    };
  }

  async sendMedia(): Promise<SyncResult> {
    return { status: 'success', message: 'Media registrato per invio manuale.' };
  }

  async getAnalytics(): Promise<AnalyticsSnapshot> {
    return {
      status: 'success',
      message: 'Statistiche calcolate sui dati inseriti manualmente nel CRM.',
    };
  }

  async refreshCredentials() {
    return { message: 'Nessuna credenziale da aggiornare in modalità manuale.' };
  }

  async checkConnection(): Promise<ConnectionCheckResult> {
    return { connected: true, message: 'Modalità manuale sempre attiva.' };
  }
}
