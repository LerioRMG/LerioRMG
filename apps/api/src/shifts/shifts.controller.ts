import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @RequirePermissions('shifts.use')
  list(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.shiftsService.list(user, from, to);
  }

  @Get('me/active')
  @RequirePermissions('shifts.use')
  myActive(@CurrentUser() user: AuthUser) {
    return this.shiftsService.myActiveShift(user);
  }

  @Post()
  @RequirePermissions('shifts.manage')
  @Audit('shift.create', 'shift')
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.shiftsService.create(user, body);
  }

  @Post(':id/clock-in')
  @RequirePermissions('shifts.use')
  @Audit('shift.clock_in', 'shift')
  clockIn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shiftsService.clockIn(user, id);
  }

  @Post(':id/clock-out')
  @RequirePermissions('shifts.use')
  @Audit('shift.clock_out', 'shift')
  clockOut(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { handoffNotes?: string }) {
    return this.shiftsService.clockOut(user, id, body?.handoffNotes);
  }
}
