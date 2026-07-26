import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManualProvider } from './manual.provider';
import { CsvImportProvider } from './csv-import.provider';
import { ExternalApiProvider } from './external-api.provider';
import { OnlyFansProvider } from './provider.interface';

/**
 * Punto unico da cui recuperare l'implementazione del provider corrispondente a un
 * account. Aggiungere un nuovo provider = implementare OnlyFansProvider e registrarlo qui,
 * senza modificare il resto del CRM (creators, sync job, controller, ecc.).
 */
@Injectable()
export class ProviderRegistryService {
  private readonly providers: Record<string, OnlyFansProvider>;

  constructor(
    private readonly manual: ManualProvider,
    private readonly csvImport: CsvImportProvider,
    private readonly config: ConfigService,
  ) {
    this.providers = {
      MANUAL: this.manual,
      CSV_IMPORT: this.csvImport,
      PROVIDER_API_1: new ExternalApiProvider({
        key: 'PROVIDER_API_1',
        label: 'Provider API 1',
        baseUrl: this.config.get<string>('PROVIDER_API_1_BASE_URL') || undefined,
        apiKey: this.config.get<string>('PROVIDER_API_1_API_KEY') || undefined,
        envVarBaseUrl: 'PROVIDER_API_1_BASE_URL',
        envVarApiKey: 'PROVIDER_API_1_API_KEY',
      }),
      PROVIDER_API_2: new ExternalApiProvider({
        key: 'PROVIDER_API_2',
        label: 'Provider API 2',
        baseUrl: this.config.get<string>('PROVIDER_API_2_BASE_URL') || undefined,
        apiKey: this.config.get<string>('PROVIDER_API_2_API_KEY') || undefined,
        envVarBaseUrl: 'PROVIDER_API_2_BASE_URL',
        envVarApiKey: 'PROVIDER_API_2_API_KEY',
      }),
    };
  }

  get(providerKey: string): OnlyFansProvider {
    const provider = this.providers[providerKey];
    if (!provider) throw new Error(`Provider sconosciuto: ${providerKey}`);
    return provider;
  }

  list() {
    return Object.values(this.providers).map((p) => ({
      key: p.key,
      label: p.label,
      configured: p.isConfigured(),
    }));
  }
}
