import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

const BROAD_VISIBILITY_ROLES = ['OWNER', 'ADMIN'];

@Injectable()
export class FansService {
  constructor(private readonly prisma: PrismaService) {}

  private creatorVisibilityFilter(user: AuthUser) {
    if (user.isOwner || BROAD_VISIBILITY_ROLES.includes(user.roleKey)) return {};
    return { creator: { assignments: { some: { userId: user.userId } } } };
  }

  async list(user: AuthUser, filters: { segment?: string; search?: string }) {
    const where: any = {
      organizationId: user.organizationId,
      ...(filters.segment ? { segment: filters.segment } : {}),
      ...(filters.search
        ? { OR: [{ username: { contains: filters.search, mode: 'insensitive' } }, { displayName: { contains: filters.search, mode: 'insensitive' } }] }
        : {}),
      ...(Object.keys(this.creatorVisibilityFilter(user)).length
        ? { creatorLinks: { some: this.creatorVisibilityFilter(user) } }
        : {}),
    };

    return this.prisma.fan.findMany({
      where,
      include: {
        creatorLinks: { include: { creator: { select: { id: true, stageName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async getById(user: AuthUser, id: string) {
    const fan = await this.prisma.fan.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        ...(Object.keys(this.creatorVisibilityFilter(user)).length
          ? { creatorLinks: { some: this.creatorVisibilityFilter(user) } }
          : {}),
      },
      include: {
        creatorLinks: { include: { creator: { select: { id: true, stageName: true } }, account: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 50 },
        aiMemories: true,
        conversations: { select: { id: true, creatorId: true, lastMessageAt: true } },
      },
    });
    if (!fan) throw new NotFoundException('Fan non trovato o non autorizzato.');
    return fan;
  }

  async update(user: AuthUser, id: string, data: { tags?: string[]; notes?: string; segment?: string; isBlacklisted?: boolean; vipLevel?: string }) {
    const fan = await this.prisma.fan.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!fan) throw new NotFoundException('Fan non trovato.');
    return this.prisma.fan.update({ where: { id }, data });
  }

  async assignChatter(user: AuthUser, fanId: string, creatorId: string, accountId: string, chatterUserId: string) {
    const link = await this.prisma.fanCreatorLink.findUnique({
      where: { fanId_creatorId_accountId: { fanId, creatorId, accountId } },
    });
    if (!link) throw new NotFoundException('Collegamento fan-creator non trovato.');
    return this.prisma.fanCreatorLink.update({
      where: { id: link.id },
      data: { assignedChatterId: chatterUserId },
    });
  }
}
