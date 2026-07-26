import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('automations')
@RequirePermissions('automations.manage')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.automationsService.list(user);
  }

  @Post()
  @Audit('automation.create', 'automation')
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.automationsService.create(user, body);
  }

  @Patch(':id/active')
  @Audit('automation.toggle', 'automation')
  setActive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.automationsService.setActive(user, id, body.isActive);
  }

  @Delete(':id')
  @Audit('automation.delete', 'automation')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.automationsService.remove(user, id);
  }
}
