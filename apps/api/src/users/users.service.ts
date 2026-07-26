import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthUser } from '../common/types/auth-user';

// Ruoli che solo l'Owner può assegnare (creazione di altri Owner/Admin)
const OWNER_ONLY_ASSIGNABLE_ROLES = ['OWNER', 'ADMIN'];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        isOwner: true,
        lastLoginAt: true,
        createdAt: true,
        hourlyRate: true,
        commissionPercent: true,
        role: { select: { key: true, name: true } },
        creatorAssignments: { select: { creator: { select: { id: true, stageName: true } }, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    if (OWNER_ONLY_ASSIGNABLE_ROLES.includes(dto.roleKey) && !actor.isOwner) {
      throw new ForbiddenException("Solo l'Owner può creare utenti Owner o Amministratore.");
    }

    const role = await this.prisma.role.findUnique({
      where: { organizationId_key: { organizationId: actor.organizationId, key: dto.roleKey } },
    });
    if (!role) throw new BadRequestException('Ruolo non valido.');

    const existing = await this.prisma.user.findUnique({
      where: { organizationId_email: { organizationId: actor.organizationId, email: dto.email } },
    });
    if (existing) throw new BadRequestException('Esiste già un utente con questa email in questa organizzazione.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        organizationId: actor.organizationId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: role.id,
        hourlyRate: dto.hourlyRate ? Number(dto.hourlyRate) : undefined,
        commissionPercent: dto.commissionPercent ? Number(dto.commissionPercent) : undefined,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: { select: { key: true } } },
    });
  }

  private async assertMutable(actor: AuthUser, targetUserId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: actor.organizationId, deletedAt: null },
      include: { role: true },
    });
    if (!target) throw new NotFoundException('Utente non trovato.');
    if (target.isOwner && actor.userId !== target.id) {
      throw new ForbiddenException("L'Owner non può essere modificato da altri utenti.");
    }
    if (target.role.key === 'ADMIN' && !actor.isOwner && actor.userId !== target.id) {
      throw new ForbiddenException('Solo Owner può modificare un Amministratore.');
    }
    return target;
  }

  async suspend(actor: AuthUser, targetUserId: string) {
    await this.assertMutable(actor, targetUserId);
    return this.prisma.user.update({ where: { id: targetUserId }, data: { status: 'SUSPENDED' } });
  }

  async activate(actor: AuthUser, targetUserId: string) {
    await this.assertMutable(actor, targetUserId);
    return this.prisma.user.update({ where: { id: targetUserId }, data: { status: 'ACTIVE' } });
  }

  async softDelete(actor: AuthUser, targetUserId: string) {
    const target = await this.assertMutable(actor, targetUserId);
    if (target.isOwner) throw new ForbiddenException("L'Owner non può essere eliminato.");
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { deletedAt: new Date(), status: 'DISABLED' },
    });
  }

  async adminResetPassword(actor: AuthUser, targetUserId: string, newPassword: string) {
    await this.assertMutable(actor, targetUserId);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });
    await this.prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
