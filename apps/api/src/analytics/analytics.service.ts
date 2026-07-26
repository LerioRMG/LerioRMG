import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async visibleCreatorIds(user: AuthUser): Promise<string[] | null> {
    if (user.isOwner || user.permissions.includes('analytics.view_all')) return null; // null = tutta l'org
    const assignments = await this.prisma.creatorAssignment.findMany({
      where: { userId: user.userId },
      select: { creatorId: true },
    });
    return assignments.map((a) => a.creatorId);
  }

  async getDashboard(user: AuthUser, from?: string, to?: string) {
    const creatorIds = await this.visibleCreatorIds(user);
    const rangeFrom = from ? new Date(from) : startOfDay(new Date(new Date().setDate(new Date().getDate() - 30)));
    const rangeTo = to ? new Date(to) : new Date();
    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const accountWhere = creatorIds ? { creatorId: { in: creatorIds } } : {};
    const accounts = await this.prisma.onlyFansAccount.findMany({ where: accountWhere, select: { id: true } });
    const accountIds = accounts.map((a) => a.id);

    const sumTransactions = async (gte: Date, lte?: Date) =>
      this.prisma.transaction.aggregate({
        where: { accountId: { in: accountIds }, occurredAt: { gte, ...(lte ? { lte } : {}) } },
        _sum: { amountGross: true, amountNet: true },
      });

    const [revenueToday, revenueLast7Days, revenueMonth, revenueRange] = await Promise.all([
      sumTransactions(today),
      sumTransactions(sevenDaysAgo),
      sumTransactions(monthStart),
      sumTransactions(rangeFrom, rangeTo),
    ]);

    const byType = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { accountId: { in: accountIds }, occurredAt: { gte: rangeFrom, lte: rangeTo } },
      _sum: { amountGross: true },
      _count: true,
    });

    const revenueByCreator = await this.prisma.transaction.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds }, occurredAt: { gte: rangeFrom, lte: rangeTo } },
      _sum: { amountGross: true },
    });
    const accountsWithCreator = await this.prisma.onlyFansAccount.findMany({
      where: { id: { in: revenueByCreator.map((r) => r.accountId) } },
      select: { id: true, creator: { select: { id: true, stageName: true } } },
    });
    const revenueByCreatorNamed = revenueByCreator.map((r) => {
      const acc = accountsWithCreator.find((a) => a.id === r.accountId);
      return { creatorId: acc?.creator.id, creatorName: acc?.creator.stageName, revenue: r._sum.amountGross || 0 };
    });

    const creatorFilter = creatorIds ? { creatorId: { in: creatorIds } } : {};
    const [activeFans, totalFans, messagesSent, messagesReceived, conversationsCount, disconnectedAccounts] =
      await Promise.all([
        this.prisma.fanCreatorLink.count({ where: { ...creatorFilter, subscriptionStatus: 'active' } }),
        this.prisma.fan.count({ where: { organizationId: user.organizationId } }),
        this.prisma.message.count({
          where: { direction: 'OUTBOUND', createdAt: { gte: rangeFrom, lte: rangeTo }, conversation: creatorFilter },
        }),
        this.prisma.message.count({
          where: { direction: 'INBOUND', createdAt: { gte: rangeFrom, lte: rangeTo }, conversation: creatorFilter },
        }),
        this.prisma.conversation.count({ where: creatorFilter }),
        this.prisma.onlyFansAccount.count({
          where: { ...accountWhere, connectionStatus: { in: ['DISCONNECTED', 'ERROR', 'NOT_CONFIGURED'] } },
        }),
      ]);

    return {
      revenue: {
        today: revenueToday._sum.amountGross || 0,
        last7Days: revenueLast7Days._sum.amountGross || 0,
        month: revenueMonth._sum.amountGross || 0,
        range: revenueRange._sum.amountGross || 0,
        byType: byType.map((t) => ({ type: t.type, total: t._sum.amountGross || 0, count: t._count })),
        byCreator: revenueByCreatorNamed,
      },
      fans: { active: activeFans, total: totalFans },
      messages: { sent: messagesSent, received: messagesReceived, conversations: conversationsCount },
      accounts: { disconnectedOrError: disconnectedAccounts, total: accountIds.length },
      filters: { from: rangeFrom, to: rangeTo },
    };
  }
}
