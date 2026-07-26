import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../common/prisma.service';

/**
 * Canale realtime di Messages Pro. L'autenticazione avviene tramite il cookie
 * hg_access_token (lo stesso JWT usato per le API REST), non con token separati finti.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.APP_URL || 'http://localhost:3000', credentials: true },
  namespace: '/realtime',
})
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConversationsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private extractToken(socket: Socket): string | null {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return null;
    const match = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith('hg_access_token='));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
  }

  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) throw new Error('Token mancante');
      const payload: any = this.jwt.verify(token, { secret: this.config.get<string>('JWT_ACCESS_SECRET') });
      socket.data.organizationId = payload.organizationId;
      socket.data.userId = payload.sub;
      socket.join(`org:${payload.organizationId}`);
    } catch (error) {
      this.logger.warn(`Connessione WebSocket rifiutata: ${(error as Error).message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect() {
    // nessuna azione necessaria: le room vengono ripulite automaticamente da socket.io
  }

  @SubscribeMessage('conversation:join')
  handleJoinConversation(socket: Socket, conversationId: string) {
    socket.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(socket: Socket, conversationId: string) {
    socket.leave(`conversation:${conversationId}`);
  }

  emitNewMessage(conversationId: string, message: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('message:new', message);
  }

  emitNotification(organizationId: string, notification: unknown) {
    this.server.to(`org:${organizationId}`).emit('notification:new', notification);
  }
}
