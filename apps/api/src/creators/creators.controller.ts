import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('creators')
@RequirePermissions('creators.view')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string, @Query('tag') tag?: string) {
    return this.creatorsService.list(user, { status, tag });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.creatorsService.getById(user, id);
  }

  @Post()
  @RequirePermissions('creators.manage')
  @Audit('creator.create', 'creator')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCreatorDto) {
    return this.creatorsService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('creators.manage')
  @Audit('creator.update', 'creator')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCreatorDto) {
    return this.creatorsService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('creators.manage')
  @Audit('creator.delete', 'creator')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.creatorsService.softDelete(user, id);
  }

  @Post(':id/assignments')
  @RequirePermissions('creators.assign')
  @Audit('creator.assign', 'creator')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { userId: string; role: string },
  ) {
    return this.creatorsService.assignUser(user, id, body.userId, body.role);
  }

  @Delete(':id/assignments/:userId/:role')
  @RequirePermissions('creators.assign')
  @Audit('creator.unassign', 'creator')
  unassign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Param('role') role: string,
  ) {
    return this.creatorsService.unassignUser(user, id, userId, role);
  }

  @Patch(':id/pricing')
  @RequirePermissions('creators.manage')
  @Audit('creator.pricing.update', 'creator')
  updatePricing(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.creatorsService.upsertPricing(user, id, body);
  }

  @Patch(':id/personality')
  @RequirePermissions('creators.manage')
  @Audit('creator.personality.update', 'creator')
  updatePersonality(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.creatorsService.upsertPersonality(user, id, body);
  }

  @Post(':id/notes')
  @Audit('creator.note.create', 'creator')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { body: string }) {
    return this.creatorsService.addNote(user, id, body.body);
  }

  @Post(':id/social-links')
  @RequirePermissions('creators.manage')
  @Audit('creator.social_link.create', 'creator')
  addSocialLink(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { platform: string; url: string },
  ) {
    return this.creatorsService.addSocialLink(user, id, body.platform, body.url);
  }
}
