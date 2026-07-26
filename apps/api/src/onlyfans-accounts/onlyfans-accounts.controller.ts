import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OnlyFansAccountsService } from './onlyfans-accounts.service';
import { ConnectAccountDto } from './dto/connect-account.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller()
export class OnlyFansAccountsController {
  constructor(private readonly accountsService: OnlyFansAccountsService) {}

  @Get('providers')
  listProviders() {
    return this.accountsService.listProviders();
  }

  @Get('creators/:creatorId/accounts')
  @RequirePermissions('creators.view')
  list(@CurrentUser() user: AuthUser, @Param('creatorId') creatorId: string) {
    return this.accountsService.listForCreator(user, creatorId);
  }

  @Post('creators/:creatorId/accounts')
  @RequirePermissions('accounts.connect')
  @Audit('account.connect', 'onlyfans_account')
  connect(
    @CurrentUser() user: AuthUser,
    @Param('creatorId') creatorId: string,
    @Body() dto: ConnectAccountDto,
  ) {
    return this.accountsService.connect(user, creatorId, dto);
  }

  @Delete('accounts/:id')
  @RequirePermissions('accounts.disconnect')
  @Audit('account.disconnect', 'onlyfans_account')
  disconnect(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.disconnect(user, id);
  }

  @Post('accounts/:id/sync/:operation')
  @RequirePermissions('accounts.connect')
  @Audit('account.sync', 'onlyfans_account')
  sync(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('operation') operation: string) {
    const allowed = ['syncProfile', 'syncFans', 'syncMessages', 'syncTransactions', 'syncSubscriptions'];
    if (!allowed.includes(operation)) {
      throw new BadRequestException(`Operazione di sincronizzazione non valida: ${operation}`);
    }
    return this.accountsService.runSync(user, id, operation as any);
  }

  @Get('accounts/:id/status')
  @RequirePermissions('creators.view')
  checkConnection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.checkConnection(user, id);
  }

  @Post('accounts/:id/import-csv')
  @RequirePermissions('accounts.connect')
  @Audit('account.import_csv', 'onlyfans_account')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nessun file caricato.');
    return this.accountsService.importCsv(user, id, file.buffer.toString('utf-8'));
  }
}
