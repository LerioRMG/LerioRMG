import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { AuthUser } from '../types/auth-user';

function makeContext(user: Partial<AuthUser> | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  function buildGuard(required: string[] | undefined) {
    const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
    return new PermissionsGuard(reflector);
  }

  it('consente l\'accesso se la rotta non richiede permessi specifici', () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(makeContext({ userId: 'u1', permissions: [] } as any))).toBe(true);
  });

  it("l'Owner ha sempre accesso, indipendentemente dai permessi richiesti", () => {
    const guard = buildGuard(['creators.manage' as any]);
    const context = makeContext({ userId: 'u1', isOwner: true, permissions: [] } as any);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('nega l\'accesso a un utente senza il permesso richiesto', () => {
    const guard = buildGuard(['creators.manage' as any]);
    const context = makeContext({ userId: 'u1', isOwner: false, permissions: ['creators.view'] } as any);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('consente l\'accesso a un utente che possiede tutti i permessi richiesti', () => {
    const guard = buildGuard(['creators.manage' as any, 'creators.view' as any]);
    const context = makeContext({
      userId: 'u1',
      isOwner: false,
      permissions: ['creators.view', 'creators.manage'],
    } as any);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('nega l\'accesso se non c\'è alcun utente autenticato nella richiesta', () => {
    const guard = buildGuard(['creators.manage' as any]);
    const context = makeContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
