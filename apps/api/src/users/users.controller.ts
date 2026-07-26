import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user.organizationId);
  }

  @Post()
  @RequirePermissions('users.create')
  @Audit('user.create', 'user')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Patch(':id/suspend')
  @RequirePermissions('users.suspend')
  @Audit('user.suspend', 'user')
  suspend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.suspend(user, id);
  }

  @Patch(':id/activate')
  @RequirePermissions('users.manage')
  @Audit('user.activate', 'user')
  activate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.activate(user, id);
  }

  @Delete(':id')
  @RequirePermissions('users.suspend')
  @Audit('user.delete', 'user')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.softDelete(user, id);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users.manage')
  @Audit('user.reset_password', 'user')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.usersService.adminResetPassword(user, id, body.newPassword);
  }
}
