import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { FinanceService } from './finance.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('finance')
@RequirePermissions('finance.view')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.financeService.summary(user, from, to);
  }

  @Get('commission-rules')
  listRules(@CurrentUser() user: AuthUser) {
    return this.financeService.listCommissionRules(user);
  }

  @Post('commission-rules')
  @RequirePermissions('finance.manage')
  @Audit('commission_rule.upsert', 'commission_rule')
  upsertRule(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.financeService.upsertCommissionRule(user, body);
  }

  @Get('export.csv')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.financeService.exportCsv(user, from, to);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="finanze.csv"');
    res.send(csv);
  }
}
