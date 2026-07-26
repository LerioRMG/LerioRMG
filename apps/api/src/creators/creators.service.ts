import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';

const BROAD_VISIBILITY_ROLES = ['OWNER', 'ADMIN'];

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Owner e Admin vedono tutte le creator dell'organizzazione. Chatter Manager e Chatter
   * vedono solo le creator a cui sono stati esplicitamente assegnati (RBAC a livello di riga).
   */
  private async visibilityFilter(user: AuthUser) {
    if (user.isOwner || BROAD_VISIBILITY_ROLES.includes(user.roleKey)) {
      return { organizationId: user.organizationId, deletedAt: null };
    }
    return {
      organizationId: user.organizationId,
      deletedAt: null,
      assignments: { some: { userId: user.userId } },
    };
  }

  async list(user: AuthUser, filters: { status?: string; tag?: string }) {
    const where: any = await this.visibilityFilter(user);
    if (filters.status) where.status = filters.status;
    if (filters.tag) where.tags = { has: filters.tag };

    return this.prisma.creator.findMany({
      where,
      include: {
        accounts: { select: { id: true, connectionStatus: true, syncStatus: true, lastSyncedAt: true } },
        assignments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        aiProfile: { select: { mode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(user: AuthUser, id: string) {
    const where: any = await this.visibilityFilter(user);
    const creator = await this.prisma.creator.findFirst({
      where: { ...where, id },
      include: {
        accounts: true,
        assignments: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        pricing: true,
        personality: true,
        aiProfile: true,
        socialLinks: true,
        documents: true,
        notes: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!creator) throw new NotFoundException('Creator non trovata o non autorizzata.');
    return creator;
  }

  async create(user: AuthUser, dto: CreateCreatorDto) {
    return this.prisma.creator.create({
      data: {
        organizationId: user.organizationId,
        stageName: dto.stageName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        language: dto.language || 'it',
        country: dto.country,
        timezone: dto.timezone || 'Europe/Rome',
        bio: dto.bio,
        tags: dto.tags || [],
        status: 'ONBOARDING',
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateCreatorDto) {
    await this.assertManageable(user, id);
    return this.prisma.creator.update({
      where: { id },
      data: {
        stageName: dto.stageName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        language: dto.language,
        country: dto.country,
        timezone: dto.timezone,
        bio: dto.bio,
        tags: dto.tags,
        status: dto.status as any,
      },
    });
  }

  private async assertManageable(user: AuthUser, creatorId: string) {
    const creator = await this.prisma.creator.findFirst({
      where: { id: creatorId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!creator) throw new NotFoundException('Creator non trovata.');
    return creator;
  }

  async softDelete(user: AuthUser, id: string) {
    await this.assertManageable(user, id);
    return this.prisma.creator.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  }

  async assignUser(user: AuthUser, creatorId: string, targetUserId: string, role: string) {
    await this.assertManageable(user, creatorId);
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: user.organizationId },
    });
    if (!targetUser) throw new NotFoundException('Utente non trovato.');
    return this.prisma.creatorAssignment.upsert({
      where: { creatorId_userId_role: { creatorId, userId: targetUserId, role: role as any } },
      update: {},
      create: { creatorId, userId: targetUserId, role: role as any },
    });
  }

  async unassignUser(user: AuthUser, creatorId: string, targetUserId: string, role: string) {
    await this.assertManageable(user, creatorId);
    await this.prisma.creatorAssignment.deleteMany({
      where: { creatorId, userId: targetUserId, role: role as any },
    });
    return { success: true };
  }

  async upsertPricing(user: AuthUser, creatorId: string, data: Record<string, unknown>) {
    await this.assertManageable(user, creatorId);
    return this.prisma.creatorPricing.upsert({
      where: { creatorId },
      update: data as any,
      create: { creatorId, ...(data as any) },
    });
  }

  async upsertPersonality(user: AuthUser, creatorId: string, data: Record<string, unknown>) {
    await this.assertManageable(user, creatorId);
    return this.prisma.creatorPersonality.upsert({
      where: { creatorId },
      update: data as any,
      create: { creatorId, ...(data as any) },
    });
  }

  async addNote(user: AuthUser, creatorId: string, body: string) {
    await this.assertManageable(user, creatorId);
    return this.prisma.creatorNote.create({
      data: { creatorId, authorId: user.userId, body },
    });
  }

  async addSocialLink(user: AuthUser, creatorId: string, platform: string, url: string) {
    await this.assertManageable(user, creatorId);
    return this.prisma.creatorSocialLink.create({ data: { creatorId, platform, url } });
  }
}
