import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { AuthUser } from '../common/types/auth-user';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { ConnectAccountDto } from './dto/connect-account.dto';

type SyncOperation =
  | 'syncProfile'
  | 'syncFans'
  | 'syncMessages'
  | 'syncTransactions'
  | 'syncSubscriptions';

@Injectable()
export class OnlyFansAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly providers: ProviderRegistryService,
  ) {}

  listProviders() {
    return this.providers.list();
  }

  private async assertCreatorInOrg(organizationId: string, creatorId: string) {
    const creator = await this.prisma.creator.findFirst({
      where: { id: creatorId, organizationId, deletedAt: null },
    });
    if (!creator) throw new NotFoundException('Creator non trovata.');
    return creator;
  }

  async listForCreator(user: AuthUser, creatorId: string) {
    await this.assertCreatorInOrg(user.organizationId, creatorId);
    return this.prisma.onlyFansAccount.findMany({
      where: { creatorId },
      include: { syncLogs: { orderBy: { startedAt: 'desc' }, take: 10 } },
    });
  }

  async connect(user: AuthUser, creatorId: string, dto: ConnectAccountDto) {
    await this.assertCreatorInOrg(user.organizationId, creatorId);
    const provider = this.providers.get(dto.provider);

    const result = await provider.connectAccount({
      username: dto.username,
      displayName: dto.displayName,
      apiKey: dto.apiKey,
      apiSecret: dto.apiSecret,
      profileUrl: dto.profileUrl,
    });

    let encryptedFields: { encryptedCredentials?: string; credentialsIv?: string; credentialsAuthTag?: string } = {};
    if ((dto.apiKey || dto.apiSecret) && this.encryption.isConfigured) {
      const payload = this.encryption.encrypt(JSON.stringify({ apiKey: dto.apiKey, apiSecret: dto.apiSecret }));
      encryptedFields = {
        encryptedCredentials: payload.ciphertext,
        credentialsIv: payload.iv,
        credentialsAuthTag: payload.authTag,
      };
    }

    const connectionStatus = provider.isConfigured() ? 'CONNECTED' : 'NOT_CONFIGURED';

    return this.prisma.onlyFansAccount.upsert({
      where: { creatorId_username: { creatorId, username: dto.username } },
      update: {
        displayName: dto.displayName,
        provider: dto.provider as any,
        connectionStatus,
        profileUrl: dto.profileUrl,
        currency: dto.currency,
        timezone: dto.timezone,
        externalAccountId: result.externalAccountId,
        lastError: connectionStatus === 'NOT_CONFIGURED' ? result.message : null,
        ...encryptedFields,
      },
      create: {
        creatorId,
        username: dto.username,
        displayName: dto.displayName,
        provider: dto.provider as any,
        connectionStatus,
        profileUrl: dto.profileUrl,
        currency: dto.currency || 'EUR',
        timezone: dto.timezone || 'Europe/Rome',
        externalAccountId: result.externalAccountId,
        lastError: connectionStatus === 'NOT_CONFIGURED' ? result.message : null,
        ...encryptedFields,
      },
    });
  }

  private async getAccountOrThrow(organizationId: string, accountId: string) {
    const account = await this.prisma.onlyFansAccount.findFirst({
      where: { id: accountId, creator: { organizationId, deletedAt: null } },
    });
    if (!account) throw new NotFoundException('Account non trovato.');
    return account;
  }

  async disconnect(user: AuthUser, accountId: string) {
    const account = await this.getAccountOrThrow(user.organizationId, accountId);
    const provider = this.providers.get(account.provider);
    await provider.disconnectAccount(account.externalAccountId);
    return this.prisma.onlyFansAccount.update({
      where: { id: accountId },
      data: { connectionStatus: 'DISCONNECTED' },
    });
  }

  async runSync(user: AuthUser, accountId: string, operation: SyncOperation) {
    const account = await this.getAccountOrThrow(user.organizationId, accountId);
    const provider = this.providers.get(account.provider);

    const log = await this.prisma.syncLog.create({
      data: { accountId, operation, status: 'SYNCING' },
    });

    const result = await provider[operation](account.externalAccountId);
    const status = result.status === 'success' ? 'SUCCESS' : result.status === 'failed' ? 'FAILED' : 'FAILED';

    await this.prisma.syncLog.update({
      where: { id: log.id },
      data: { status: status as any, message: result.message, finishedAt: new Date() },
    });

    await this.prisma.onlyFansAccount.update({
      where: { id: accountId },
      data: {
        syncStatus: status as any,
        lastSyncedAt: new Date(),
        lastError: status === 'FAILED' ? result.message : null,
      },
    });

    return result;
  }

  async checkConnection(user: AuthUser, accountId: string) {
    const account = await this.getAccountOrThrow(user.organizationId, accountId);
    const provider = this.providers.get(account.provider);
    return provider.checkConnection(account.externalAccountId);
  }

  /**
   * Importazione CSV reale. Formato atteso (intestazione obbligatoria):
   * fan_username,fan_display_name,transaction_type,amount_gross,amount_net,currency,occurred_at
   * transaction_type in: SUBSCRIPTION, RENEWAL, PPV, TIP, CUSTOM, CHARGEBACK, REFUND (opzionale)
   */
  async importCsv(user: AuthUser, accountId: string, csvContent: string) {
    const account = await this.prisma.onlyFansAccount.findFirst({
      where: { id: accountId, creator: { organizationId: user.organizationId, deletedAt: null } },
      include: { creator: true },
    });
    if (!account) throw new NotFoundException('Account non trovato.');
    if (account.provider !== 'CSV_IMPORT') {
      throw new BadRequestException('Questo account non usa il provider di importazione CSV.');
    }

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new BadRequestException('Il file CSV è vuoto o privo di righe dati.');

    const header = lines[0].split(',').map((h) => h.trim());
    const required = ['fan_username', 'fan_display_name'];
    for (const col of required) {
      if (!header.includes(col)) throw new BadRequestException(`Colonna obbligatoria mancante: ${col}`);
    }

    let importedFans = 0;
    let importedTransactions = 0;

    for (const line of lines.slice(1)) {
      const cols = line.split(',').map((c) => c.trim());
      const row: Record<string, string> = {};
      header.forEach((h, i) => (row[h] = cols[i] ?? ''));
      if (!row.fan_username) continue;

      const fan = await this.prisma.fan.upsert({
        where: { organizationId_username: { organizationId: user.organizationId, username: row.fan_username } },
        update: { displayName: row.fan_display_name || undefined },
        create: {
          organizationId: user.organizationId,
          username: row.fan_username,
          displayName: row.fan_display_name || row.fan_username,
        },
      });
      importedFans += 1;

      await this.prisma.fanCreatorLink.upsert({
        where: {
          fanId_creatorId_accountId: { fanId: fan.id, creatorId: account.creatorId, accountId: account.id },
        },
        update: {},
        create: { fanId: fan.id, creatorId: account.creatorId, accountId: account.id },
      });

      if (row.transaction_type && row.amount_gross) {
        await this.prisma.transaction.create({
          data: {
            accountId: account.id,
            fanId: fan.id,
            type: row.transaction_type as any,
            amountGross: Number(row.amount_gross),
            amountNet: Number(row.amount_net || row.amount_gross),
            currency: row.currency || account.currency,
            occurredAt: row.occurred_at ? new Date(row.occurred_at) : new Date(),
          },
        });
        importedTransactions += 1;
      }
    }

    await this.prisma.onlyFansAccount.update({
      where: { id: account.id },
      data: { syncStatus: 'SUCCESS', lastSyncedAt: new Date(), connectionStatus: 'CONNECTED', lastError: null },
    });

    return { importedFans, importedTransactions };
  }
}
