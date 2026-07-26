import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.automation.findMany({
      where: { organizationId: user.organizationId },
      include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    user: AuthUser,
    data: { name: string; trigger: string; conditions?: Record<string, unknown>; actions: Record<string, unknown> },
  ) {
    return this.prisma.automation.create({
      data: {
        organizationId: user.organizationId,
        name: data.name,
        trigger: data.trigger as any,
        conditions: data.conditions as any,
        actions: data.actions as any,
        isActive: false,
      },
    });
  }

  async setActive(user: AuthUser, id: string, isActive: boolean) {
    const automation = await this.prisma.automation.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!automation) throw new NotFoundException('Automazione non trovata.');
    return this.prisma.automation.update({ where: { id }, data: { isActive } });
  }

  async remove(user: AuthUser, id: string) {
    const automation = await this.prisma.automation.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!automation) throw new NotFoundException('Automazione non trovata.');
    return this.prisma.automation.delete({ where: { id } });
  }
}
