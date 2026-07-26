import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ALL_PERMISSIONS, ROLE_DEFINITIONS } = require('../../../packages/database/prisma/permission-matrix');

/**
 * Test end-to-end contro un database PostgreSQL reale (DATABASE_URL).
 * Copre: login/refresh/logout, RBAC, isolamento multi-tenant, CRUD creator, audit log.
 * Richiede che Postgres sia raggiungibile (vedi README - avviare `docker compose up -d postgres`
 * oppure un'istanza Postgres locale) e che le migrazioni siano state applicate.
 */
describe('Honey Garden CRM - API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = Date.now();
  const orgASlug = `test-org-a-${runId}`;
  const orgBSlug = `test-org-b-${runId}`;
  let orgAId: string;
  let orgBId: string;
  let creatorAId: string;

  const ownerAEmail = `owner-a-${runId}@test.local`;
  const chatterAEmail = `chatter-a-${runId}@test.local`;
  const ownerBEmail = `owner-b-${runId}@test.local`;
  const plainPassword = 'TestPassword123!';

  function extractCookie(res: request.Response): string {
    const raw = res.headers['set-cookie'] as unknown as string[];
    return raw.map((c) => c.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    // Permessi globali (idempotente)
    for (const perm of ALL_PERMISSIONS as Array<{ key: string; description: string }>) {
      await prisma.permission.upsert({
        where: { key: perm.key },
        update: {},
        create: perm,
      });
    }
    const permissions = await prisma.permission.findMany();
    const permByKey = new Map(permissions.map((p) => [p.key, p.id]));

    const orgA = await prisma.organization.create({ data: { name: 'Test Org A', slug: orgASlug } });
    const orgB = await prisma.organization.create({ data: { name: 'Test Org B', slug: orgBSlug } });
    orgAId = orgA.id;
    orgBId = orgB.id;

    async function createRoles(organizationId: string) {
      const roleIds = new Map<string, string>();
      for (const roleDef of ROLE_DEFINITIONS as Array<{ key: string; name: string; isSystem: boolean; permissions: string[] }>) {
        const role = await prisma.role.create({
          data: { organizationId, key: roleDef.key, name: roleDef.name, isSystem: roleDef.isSystem },
        });
        roleIds.set(roleDef.key, role.id);
        for (const permKey of roleDef.permissions) {
          const permissionId = permByKey.get(permKey);
          if (!permissionId) continue;
          await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
        }
      }
      return roleIds;
    }

    const rolesA = await createRoles(orgAId);
    const rolesB = await createRoles(orgBId);

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await prisma.user.create({
      data: {
        organizationId: orgAId,
        email: ownerAEmail,
        passwordHash,
        firstName: 'Owner',
        lastName: 'A',
        roleId: rolesA.get('OWNER')!,
        isOwner: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        organizationId: orgAId,
        email: chatterAEmail,
        passwordHash,
        firstName: 'Chatter',
        lastName: 'A',
        roleId: rolesA.get('CHATTER')!,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        organizationId: orgBId,
        email: ownerBEmail,
        passwordHash,
        firstName: 'Owner',
        lastName: 'B',
        roleId: rolesB.get('OWNER')!,
        isOwner: true,
        emailVerifiedAt: new Date(),
      },
    });

    const creatorA = await prisma.creator.create({
      data: { organizationId: orgAId, stageName: 'Creator Test A', status: 'ACTIVE' },
    });
    creatorAId = creatorA.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await app.close();
  });

  describe('Autenticazione', () => {
    it('rifiuta il login con password errata', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: 'password-sbagliata' })
        .expect(401);
    });

    it('accetta il login con credenziali corrette e imposta i cookie httpOnly', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: plainPassword })
        .expect(200);

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      expect(setCookie.some((c) => c.startsWith('hg_access_token='))).toBe(true);
      expect(setCookie.some((c) => c.startsWith('hg_refresh_token='))).toBe(true);
      expect(setCookie.every((c) => c.toLowerCase().includes('httponly'))).toBe(true);
    });

    it('GET /auth/me restituisce i dati dell\'utente autenticato dopo il login', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      const meRes = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);
      expect(meRes.body.email).toBe(ownerAEmail);
      expect(meRes.body.organizationId).toBe(orgAId);
      expect(meRes.body.isOwner).toBe(true);
    });

    it('rifiuta le richieste senza token di autenticazione', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('il refresh token permette di ottenere un nuovo access token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      const refreshRes = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
      const newCookie = extractCookie(refreshRes);
      await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', newCookie).expect(200);
    });

    it('dopo il logout la sessione non è più valida', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(200);
      await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
    });
  });

  describe('RBAC - permessi per ruolo', () => {
    it('un Chatter non può creare nuovi utenti (manca users.create)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: chatterAEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Cookie', cookie)
        .send({ email: `nope-${runId}@test.local`, password: 'abcdefghij', firstName: 'N', lastName: 'O', roleKey: 'CHATTER' })
        .expect(403);
    });

    it("l'Owner può creare nuovi utenti", async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Cookie', cookie)
        .send({
          email: `created-${runId}@test.local`,
          password: 'abcdefghij',
          firstName: 'Nuovo',
          lastName: 'Utente',
          roleKey: 'CHATTER',
        })
        .expect(201);
    });

    it('un Chatter non assegnato a una creator non la vede nell\'elenco', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: chatterAEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      const res = await request(app.getHttpServer()).get('/api/creators').set('Cookie', cookie).expect(200);
      expect(res.body.find((c: { id: string }) => c.id === creatorAId)).toBeUndefined();
    });
  });

  describe('Isolamento multi-tenant', () => {
    it("un utente dell'organizzazione B non può vedere una creator dell'organizzazione A", async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerBEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      await request(app.getHttpServer()).get(`/api/creators/${creatorAId}`).set('Cookie', cookie).expect(404);
    });

    it("l'Owner dell'organizzazione A vede correttamente la propria creator", async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: plainPassword });
      const cookie = extractCookie(loginRes);

      const res = await request(app.getHttpServer()).get(`/api/creators/${creatorAId}`).set('Cookie', cookie).expect(200);
      expect(res.body.stageName).toBe('Creator Test A');
    });
  });

  describe('Creator CRUD e audit log', () => {
    let cookie: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ownerAEmail, password: plainPassword });
      cookie = extractCookie(loginRes);
    });

    it('crea una nuova creator', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/creators')
        .set('Cookie', cookie)
        .send({ stageName: `Nuova Creator ${runId}` })
        .expect(201);
      expect(res.body.stageName).toBe(`Nuova Creator ${runId}`);
    });

    it("registra l'azione nell'audit log", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/audit-log?action=creator.create')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items[0].action).toBe('creator.create');
    });

    it('il provider OnlyFans non configurato viene dichiarato esplicitamente', async () => {
      const res = await request(app.getHttpServer()).get('/api/providers').set('Cookie', cookie).expect(200);
      const providerApi1 = res.body.find((p: { key: string }) => p.key === 'PROVIDER_API_1');
      expect(providerApi1.configured).toBe(false);
    });
  });
});
