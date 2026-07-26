import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

const ACCESS_COOKIE = 'hg_access_token';
const REFRESH_COOKIE = 'hg_refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password, dto.otpCode, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if ('requiresOtp' in result && result.requiresOtp && !('accessToken' in result)) {
      return { requiresOtp: true };
    }
    const { accessToken, refreshToken } = result as unknown as { accessToken: string; refreshToken: string };
    res.cookie(ACCESS_COOKIE, accessToken, this.cookieOptions(15 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(30 * 24 * 60 * 60 * 1000));
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    const result = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.cookie(ACCESS_COOKIE, result.accessToken, this.cookieOptions(15 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions(30 * 24 * 60 * 60 * 1000));
    return { success: true };
  }

  @Post('logout')
  @HttpCode(200)
  @Audit('logout', 'auth')
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sessionId);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.authService.listSessions(user.userId);
  }

  @Delete('sessions/:id')
  @Audit('session.revoke', 'auth')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.authService.revokeSession(user.userId, id);
  }

  @Post('password/change')
  @Audit('password.change', 'auth')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300 } })
  @Post('password/reset-request')
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300 } })
  @Post('password/reset-confirm')
  confirmReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }

  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthUser) {
    return this.authService.setupTwoFactor(user.userId);
  }

  @Post('2fa/confirm')
  @Audit('2fa.enable', 'auth')
  confirmTwoFactor(@CurrentUser() user: AuthUser, @Body() body: { otpCode: string }) {
    if (!body?.otpCode) throw new UnauthorizedException('Codice OTP mancante.');
    return this.authService.confirmTwoFactor(user.userId, body.otpCode);
  }

  @Post('2fa/disable')
  @Audit('2fa.disable', 'auth')
  disableTwoFactor(@CurrentUser() user: AuthUser) {
    return this.authService.disableTwoFactor(user.userId);
  }
}
