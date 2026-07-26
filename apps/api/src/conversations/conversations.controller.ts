import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller()
@RequirePermissions('messages.view')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get('creators/:creatorId/conversations')
  listForCreator(
    @CurrentUser() user: AuthUser,
    @Param('creatorId') creatorId: string,
    @Query('unread') unread?: string,
    @Query('vip') vip?: string,
  ) {
    return this.conversationsService.listForCreator(user, creatorId, {
      unread: unread === 'true',
      vip: vip === 'true',
    });
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversationsService.getConversation(user, id);
  }

  @Post('conversations')
  getOrCreate(
    @CurrentUser() user: AuthUser,
    @Body() body: { creatorId: string; accountId: string; fanId: string },
  ) {
    return this.conversationsService.getOrCreateConversation(user, body.creatorId, body.accountId, body.fanId);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('messages.send')
  @Audit('message.send', 'conversation')
  sendMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.conversationsService.sendMessage(user, id, body);
  }

  @Post('conversations/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversationsService.markRead(user, id);
  }
}
