import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [{ userId: user.userId }, { userId: null }],
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(user: AuthUser, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!notification) throw new NotFoundException('Notifica non trovata.');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
