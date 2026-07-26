import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { ProviderRegistryService } from '../onlyfans-accounts/providers/provider-registry.service';
import { ConversationsGateway } from './conversations.gateway';

const BROAD_VISIBILITY_ROLES = ['OWNER', 'ADMIN'];

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly gateway: ConversationsGateway,
  ) {}

  private async assertCreatorAccess(user: AuthUser, creatorId: string) {
    const creator = await this.prisma.creator.findFirst({
      where: { id: creatorId, organizationId: user.organizationId, deletedAt: null },
      include: { assignments: true },
    });
    if (!creator) throw new NotFoundException('Creator non trovata.');
    if (!user.isOwner && !BROAD_VISIBILITY_ROLES.includes(user.roleKey)) {
      const assigned = creator.assignments.some((a) => a.userId === user.userId);
      if (!assigned) throw new ForbiddenException('Non sei assegnato a questa creator.');
    }
    return creator;
  }

  async listForCreator(user: AuthUser, creatorId: string, filters: { unread?: boolean; vip?: boolean }) {
    await this.assertCreatorAccess(user, creatorId);
    return this.prisma.conversation.findMany({
      where: {
        creatorId,
        ...(filters.unread ? { unreadCount: { gt: 0 } } : {}),
        ...(filters.vip ? { isVip: true } : {}),
      },
      include: {
        fan: { select: { id: true, username: true, displayName: true, avatarUrl: true, vipLevel: true, lifetimeValue: true } },
        account: { select: { id: true, username: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getConversation(user: AuthUser, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, creator: { organizationId: user.organizationId } },
      include: {
        creator: { include: { assignments: true } },
        fan: true,
        account: true,
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
      },
    });
    if (!conversation) throw new NotFoundException('Conversazione non trovata.');
    if (!user.isOwner && !BROAD_VISIBILITY_ROLES.includes(user.roleKey)) {
      const assigned = conversation.creator.assignments.some((a) => a.userId === user.userId);
      if (!assigned) throw new ForbiddenException('Non sei assegnato a questa creator.');
    }
    return conversation;
  }

  async getOrCreateConversation(user: AuthUser, creatorId: string, accountId: string, fanId: string) {
    await this.assertCreatorAccess(user, creatorId);
    return this.prisma.conversation.upsert({
      where: { creatorId_accountId_fanId: { creatorId, accountId, fanId } },
      update: {},
      create: { creatorId, accountId, fanId },
    });
  }

  async sendMessage(
    user: AuthUser,
    conversationId: string,
    body: { body?: string; mediaUrl?: string; price?: number; isPpv?: boolean; scheduledFor?: string },
  ) {
    const conversation = await this.getConversation(user, conversationId);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        status: body.scheduledFor ? 'SCHEDULED' : 'SENT',
        body: body.body,
        mediaUrl: body.mediaUrl,
        price: body.price,
        isPpv: body.isPpv || false,
        senderUserId: user.userId,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Se l'account usa un provider realmente collegato, tenta l'invio reale;
    // altrimenti il messaggio resta registrato solo internamente nel CRM.
    if (!body.scheduledFor) {
      const provider = this.providers.get(conversation.account.provider);
      if (provider.isConfigured() && conversation.account.provider !== 'MANUAL') {
        await provider.sendMessage(conversation.account.externalAccountId, {
          fanExternalId: conversation.fan.externalId || conversation.fan.username,
          body: body.body || '',
          price: body.price,
        });
      }
    }

    this.gateway.emitNewMessage(conversationId, message);
    return message;
  }

  async markRead(user: AuthUser, conversationId: string) {
    await this.getConversation(user, conversationId);
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
  }
}
