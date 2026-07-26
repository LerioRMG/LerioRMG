import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Permission } from '../common/permissions';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listAllPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async createCustomRole(organizationId: string, name: string, permissionKeys: Permission[]) {
    const key = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const existing = await this.prisma.role.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    if (existing) throw new BadRequestException('Esiste già un ruolo con questo nome.');

    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    return this.prisma.role.create({
      data: {
        organizationId,
        key,
        name,
        isSystem: false,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async updateRolePermissions(organizationId: string, roleId: string, permissionKeys: Permission[]) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException('Ruolo non trovato.');
    if (role.isSystem && role.key === 'OWNER') {
      throw new BadRequestException('I permessi del ruolo Owner non possono essere modificati.');
    }
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    });
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
  }
}
