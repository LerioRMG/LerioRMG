import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('creators/:creatorId/ai-profile')
  @RequirePermissions('ai.use')
  getProfile(@CurrentUser() user: AuthUser, @Param('creatorId') creatorId: string) {
    return this.aiService.getProfile(user, creatorId);
  }

  @Patch('creators/:creatorId/ai-profile')
  @RequirePermissions('ai.configure')
  @Audit('ai_profile.update', 'creator')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('creatorId') creatorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.aiService.updateProfile(user, creatorId, body);
  }

  @Post('conversations/:id/ai-suggest')
  @RequirePermissions('ai.use')
  @Audit('ai.suggest', 'conversation')
  suggest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aiService.suggestReply(user, id);
  }

  @Get('fans/:fanId/ai-memory')
  @RequirePermissions('ai.use')
  listMemories(@CurrentUser() user: AuthUser, @Param('fanId') fanId: string) {
    return this.aiService.listMemories(user, fanId);
  }

  @Post('fans/:fanId/ai-memory')
  @RequirePermissions('ai.use')
  @Audit('ai_memory.create', 'fan')
  addMemory(@CurrentUser() user: AuthUser, @Param('fanId') fanId: string, @Body() body: { key: string; value: string }) {
    return this.aiService.addMemory(user, fanId, body.key, body.value);
  }

  @Delete('fans/:fanId/ai-memory/:memoryId')
  @RequirePermissions('ai.use')
  @Audit('ai_memory.delete', 'fan')
  deleteMemory(@CurrentUser() user: AuthUser, @Param('fanId') fanId: string, @Param('memoryId') memoryId: string) {
    return this.aiService.deleteMemory(user, fanId, memoryId);
  }
}
