import { Body, Controller, Get, Patch } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('organization')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.orgService.getCurrent(user.organizationId);
  }

  @Patch()
  @RequirePermissions('org.manage')
  @Audit('organization.update', 'organization')
  update(@CurrentUser() user: AuthUser, @Body() body: { name?: string }) {
    return this.orgService.update(user.organizationId, body);
  }
}
