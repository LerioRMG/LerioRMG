import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { AuthUser } from '../../common/types/auth-user';

interface AccessTokenPayload {
  sub: string;
  organizationId: string;
  sessionId: string;
}

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.['hg_access_token'] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Utente non valido o disattivato.');
    }
    if (user.organizationId !== payload.organizationId) {
      throw new UnauthorizedException('Token non valido per questa organizzazione.');
    }

    const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessione scaduta o revocata.');
    }

    return {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roleKey: user.role.key,
      isOwner: user.isOwner,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
      sessionId: session.id,
    };
  }
}
