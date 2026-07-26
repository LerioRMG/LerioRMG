import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FansService } from './fans.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('fans')
@RequirePermissions('fans.view')
export class FansController {
  constructor(private readonly fansService: FansService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('segment') segment?: string, @Query('search') search?: string) {
    return this.fansService.list(user, { segment, search });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fansService.getById(user, id);
  }

  @Patch(':id')
  @RequirePermissions('fans.manage')
  @Audit('fan.update', 'fan')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.fansService.update(user, id, body);
  }

  @Post(':id/assign-chatter')
  @RequirePermissions('fans.manage')
  @Audit('fan.assign_chatter', 'fan')
  assignChatter(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { creatorId: string; accountId: string; chatterUserId: string },
  ) {
    return this.fansService.assignChatter(user, id, body.creatorId, body.accountId, body.chatterUserId);
  }
}
