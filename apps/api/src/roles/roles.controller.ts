import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';
import { Permission } from '../common/permissions';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.rolesService.list(user.organizationId);
  }

  @Get('permissions')
  listPermissions() {
    return this.rolesService.listAllPermissions();
  }

  @Post()
  @RequirePermissions('roles.manage')
  @Audit('role.create', 'role')
  create(@CurrentUser() user: AuthUser, @Body() body: { name: string; permissions: Permission[] }) {
    return this.rolesService.createCustomRole(user.organizationId, body.name, body.permissions);
  }

  @Patch(':id/permissions')
  @RequirePermissions('roles.manage')
  @Audit('role.update_permissions', 'role')
  updatePermissions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { permissions: Permission[] },
  ) {
    return this.rolesService.updateRolePermissions(user.organizationId, id, body.permissions);
  }
}
