import { Module } from '@nestjs/common';
import { OnlyFansAccountsController } from './onlyfans-accounts.controller';
import { OnlyFansAccountsService } from './onlyfans-accounts.service';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { ManualProvider } from './providers/manual.provider';
import { CsvImportProvider } from './providers/csv-import.provider';

@Module({
  controllers: [OnlyFansAccountsController],
  providers: [OnlyFansAccountsService, ProviderRegistryService, ManualProvider, CsvImportProvider],
  exports: [OnlyFansAccountsService, ProviderRegistryService],
})
export class OnlyFansAccountsModule {}
