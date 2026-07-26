import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { PrismaService } from '../common/prisma.service';
import { MailService } from '../notifications/mail.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async login(email: string, password: string, otpCode: string | undefined, meta: RequestMeta) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });

    // Messaggio generico per non rivelare se l'email esiste (mitiga enumerazione utenti)
    const genericError = new UnauthorizedException('Credenziali non valide.');

    if (!user) throw genericError;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Account temporaneamente bloccato per troppi tentativi falliti. Riprova dopo ${user.lockedUntil.toLocaleTimeString('it-IT')}.`,
      );
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account non attivo. Contatta un amministratore.');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      await this.registerFailedAttempt(user.id);
      throw genericError;
    }

    if (user.twoFactorEnabled) {
      if (!otpCode) {
        return { requiresOtp: true };
      }
      const secret = user.twoFactorSecret;
      const validOtp = secret ? authenticator.check(otpCode, secret) : false;
      if (!validOtp) {
        await this.registerFailedAttempt(user.id);
        throw new UnauthorizedException('Codice OTP non valido.');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return this.issueSession(user.id, user.organizationId, meta);
  }

  private async registerFailedAttempt(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
    if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) },
      });
    }
  }

  private async issueSession(userId: string, organizationId: string, meta: RequestMeta) {
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);
    const refreshTtlDays = 30;

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = this.signAccessToken(userId, organizationId, session.id);
    return {
      accessToken,
      refreshToken: `${session.id}.${rawRefreshToken}`,
      requiresOtp: false as const,
    };
  }

  private signAccessToken(userId: string, organizationId: string, sessionId: string) {
    return this.jwt.sign(
      { sub: userId, organizationId, sessionId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') || '15m',
      },
    );
  }

  async refresh(refreshTokenRaw: string | undefined, meta: RequestMeta) {
    if (!refreshTokenRaw || !refreshTokenRaw.includes('.')) {
      throw new UnauthorizedException('Refresh token mancante o non valido.');
    }
    const [sessionId, rawToken] = refreshTokenRaw.split('.', 2);
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessione scaduta o revocata.');
    }
    const valid = await bcrypt.compare(rawToken, session.refreshTokenHash);
    if (!valid) {
      // possibile riuso di un token rubato: revoca la sessione per sicurezza
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Refresh token non valido.');
    }

    // Rotazione del refresh token
    const newRawToken = crypto.randomBytes(48).toString('hex');
    const newHash = await bcrypt.hash(newRawToken, 10);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: newHash, userAgent: meta.userAgent, ipAddress: meta.ipAddress },
    });

    const accessToken = this.signAccessToken(session.userId, session.user.organizationId, session.id);
    return { accessToken, refreshToken: `${session.id}.${newRawToken}` };
  }

  async logout(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, deviceLabel: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new BadRequestException('Sessione non trovata.');
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Password attuale non corretta.');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Revoca tutte le altre sessioni per sicurezza dopo il cambio password
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    // Non rivelare se l'utente esiste
    if (!user) return { sent: true };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    await this.mail.send({
      to: user.email,
      subject: 'Honey Garden CRM - Reimposta la tua password',
      text: `Per reimpostare la password visita: ${appUrl}/reset-password?token=${user.id}.${rawToken}`,
    });

    return { sent: true };
  }

  async confirmPasswordReset(compoundToken: string, newPassword: string) {
    const [userId, rawToken] = compoundToken.split('.', 2);
    if (!userId || !rawToken) throw new BadRequestException('Token non valido.');

    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    for (const candidate of candidates) {
      if (await bcrypt.compare(rawToken, candidate.tokenHash)) {
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await this.prisma.$transaction([
          this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
          this.prisma.passwordResetToken.update({ where: { id: candidate.id }, data: { usedAt: new Date() } }),
          this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        ]);
        return { success: true };
      }
    }
    throw new BadRequestException('Token non valido o scaduto.');
  }

  async setupTwoFactor(userId: string) {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const otpauth = authenticator.keyuri(user.email, 'Honey Garden CRM', secret);
    return { secret, otpauth };
  }

  async confirmTwoFactor(userId: string, otpCode: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret || !authenticator.check(otpCode, user.twoFactorSecret)) {
      throw new BadRequestException('Codice OTP non valido.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { enabled: true };
  }

  async disableTwoFactor(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { enabled: false };
  }
}
