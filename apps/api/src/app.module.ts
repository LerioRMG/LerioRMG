import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { CreatorsModule } from './creators/creators.module';
import { OnlyFansAccountsModule } from './onlyfans-accounts/onlyfans-accounts.module';
import { FansModule } from './fans/fans.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ShiftsModule } from './shifts/shifts.module';
import { FinanceModule } from './finance/finance.module';
import { MediaModule } from './media/media.module';
import { AutomationsModule } from './automations/automations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL || 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT || 100),
      },
    ]),
    ScheduleModule.forRoot(),
    CommonModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    RolesModule,
    CreatorsModule,
    OnlyFansAccountsModule,
    FansModule,
    ConversationsModule,
    AiModule,
    AnalyticsModule,
    ShiftsModule,
    FinanceModule,
    MediaModule,
    AutomationsModule,
    NotificationsModule,
    AuditLogModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
