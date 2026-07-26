import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organizzazione non trovata.');
    return org;
  }

  async update(organizationId: string, data: { name?: string }) {
    return this.prisma.organization.update({ where: { id: organizationId }, data });
  }
}
