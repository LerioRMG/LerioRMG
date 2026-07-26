import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { AuthUser } from '../types/auth-user';

/**
 * Registra le azioni sensibili nell'audit log immutabile.
 * Il log viene scritto sia in caso di successo che di errore e non espone endpoint di modifica/eliminazione.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    const write = (result: 'success' | 'failure', errorMessage?: string) => {
      if (!user) return;
      this.prisma.auditLog
        .create({
          data: {
            organizationId: user.organizationId,
            userId: user.userId,
            action: meta.action,
            resource: meta.resource,
            resourceId: request.params?.id,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            newValue: result === 'success' ? (sanitizeBody(request.body) as any) : undefined,
            result,
            errorMessage,
          },
        })
        .catch(() => undefined);
    };

    return next.handle().pipe(
      tap(() => write('success')),
      catchError((err) => {
        write('failure', err?.message);
        throw err;
      }),
    );
  }
}

function sanitizeBody(body: unknown) {
  if (!body || typeof body !== 'object') return undefined;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of ['password', 'newPassword', 'currentPassword', 'token', 'apiKey', 'secret']) {
    if (key in clone) clone[key] = '***';
  }
  return clone;
}
