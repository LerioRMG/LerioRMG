import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, from?: string, to?: string) {
    return this.prisma.shift.findMany({
      where: {
        organizationId: user.organizationId,
        ...(from || to
          ? { startsAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      include: { assignments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async create(user: AuthUser, data: { startsAt: string; endsAt: string; isRecurring?: boolean; notes?: string; userIds: string[] }) {
    return this.prisma.shift.create({
      data: {
        organizationId: user.organizationId,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        isRecurring: data.isRecurring || false,
        notes: data.notes,
        assignments: { create: data.userIds.map((userId) => ({ userId })) },
      },
      include: { assignments: true },
    });
  }

  private async assertOwnAssignment(user: AuthUser, shiftId: string) {
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { shiftId, userId: user.userId },
    });
    if (!assignment) throw new ForbiddenException('Non sei assegnato a questo turno.');
    return assignment;
  }

  async clockIn(user: AuthUser, shiftId: string) {
    const assignment = await this.assertOwnAssignment(user, shiftId);
    return this.prisma.shiftAssignment.update({ where: { id: assignment.id }, data: { clockInAt: new Date() } });
  }

  async clockOut(user: AuthUser, shiftId: string, handoffNotes?: string) {
    const assignment = await this.assertOwnAssignment(user, shiftId);
    return this.prisma.shiftAssignment.update({
      where: { id: assignment.id },
      data: { clockOutAt: new Date(), handoffNotes },
    });
  }

  async myActiveShift(user: AuthUser) {
    return this.prisma.shiftAssignment.findFirst({
      where: { userId: user.userId, clockInAt: { not: null }, clockOutAt: null },
      include: { shift: true },
    });
  }
}
