import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listCommissionRules(user: AuthUser) {
    return this.prisma.commissionRule.findMany({ where: { organizationId: user.organizationId } });
  }

  async upsertCommissionRule(
    user: AuthUser,
    data: { id?: string; scope: string; scopeRefId?: string; percent: number },
  ) {
    if (data.id) {
      return this.prisma.commissionRule.update({
        where: { id: data.id },
        data: { scope: data.scope, scopeRefId: data.scopeRefId, percent: data.percent },
      });
    }
    return this.prisma.commissionRule.create({
      data: {
        organizationId: user.organizationId,
        scope: data.scope,
        scopeRefId: data.scopeRefId,
        percent: data.percent,
      },
    });
  }

  async summary(user: AuthUser, from?: string, to?: string) {
    const rangeFrom = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const rangeTo = to ? new Date(to) : new Date();

    const accounts = await this.prisma.onlyFansAccount.findMany({
      where: { creator: { organizationId: user.organizationId } },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const [gross, net, fees, chargebacks, refunds] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { accountId: { in: accountIds }, occurredAt: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amountGross: true },
      }),
      this.prisma.transaction.aggregate({
        where: { accountId: { in: accountIds }, occurredAt: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amountNet: true },
      }),
      this.prisma.transaction.aggregate({
        where: { accountId: { in: accountIds }, occurredAt: { gte: rangeFrom, lte: rangeTo } },
        _sum: { feeAmount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { accountId: { in: accountIds }, type: 'CHARGEBACK', occurredAt: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amountGross: true },
      }),
      this.prisma.transaction.aggregate({
        where: { accountId: { in: accountIds }, type: 'REFUND', occurredAt: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amountGross: true },
      }),
    ]);

    return {
      grossRevenue: gross._sum.amountGross || 0,
      netRevenue: net._sum.amountNet || 0,
      totalFees: fees._sum.feeAmount || 0,
      chargebacks: chargebacks._sum.amountGross || 0,
      refunds: refunds._sum.amountGross || 0,
      range: { from: rangeFrom, to: rangeTo },
    };
  }

  async exportCsv(user: AuthUser, from?: string, to?: string): Promise<string> {
    const accounts = await this.prisma.onlyFansAccount.findMany({
      where: { creator: { organizationId: user.organizationId } },
      select: { id: true, displayName: true },
    });
    const accountIds = accounts.map((a) => a.id);
    const rangeFrom = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const rangeTo = to ? new Date(to) : new Date();

    const transactions = await this.prisma.transaction.findMany({
      where: { accountId: { in: accountIds }, occurredAt: { gte: rangeFrom, lte: rangeTo } },
      orderBy: { occurredAt: 'desc' },
    });

    const header = 'data,account,tipo,lordo,netto,fee,valuta';
    const rows = transactions.map((t) => {
      const acc = accounts.find((a) => a.id === t.accountId);
      return [
        t.occurredAt.toISOString(),
        acc?.displayName || '',
        t.type,
        t.amountGross.toString(),
        t.amountNet.toString(),
        t.feeAmount.toString(),
        t.currency,
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }
}
