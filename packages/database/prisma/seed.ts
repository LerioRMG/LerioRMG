import { PrismaClient } from '../generated/client';
import * as bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from './permission-matrix';

const prisma = new PrismaClient();

async function main() {
  const orgName = process.env.SEED_ORGANIZATION_NAME || 'Honey Garden';
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;

  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'SEED_OWNER_EMAIL e SEED_OWNER_PASSWORD devono essere impostate nel file .env prima di eseguire il seed.',
    );
  }

  console.log(`Seed in corso per l'organizzazione "${orgName}"...`);

  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const organization = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: { name: orgName, slug },
  });

  // 1. Permessi globali
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: perm,
    });
  }
  const permissions = await prisma.permission.findMany();
  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));

  // 2. Ruoli di sistema + assegnazione permessi
  const roleIdByKey = new Map<string, string>();
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: organization.id, key: roleDef.key } },
      update: { name: roleDef.name, isSystem: roleDef.isSystem },
      create: {
        organizationId: organization.id,
        key: roleDef.key,
        name: roleDef.name,
        isSystem: roleDef.isSystem,
      },
    });
    roleIdByKey.set(roleDef.key, role.id);

    for (const permKey of roleDef.permissions) {
      const permissionId = permByKey.get(permKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  // 3. Owner
  const ownerRoleId = roleIdByKey.get('OWNER')!;
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const owner = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: ownerEmail } },
    update: {},
    create: {
      organizationId: organization.id,
      email: ownerEmail,
      passwordHash,
      firstName: 'Owner',
      lastName: 'Honey Garden',
      roleId: ownerRoleId,
      isOwner: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Owner creato/aggiornato: ${owner.email}`);

  // 4. Utenti demo (admin, chatter manager, chatter)
  const demoUsersDef = [
    { email: 'admin.demo@honeygarden.local', role: 'ADMIN', firstName: 'Admin', lastName: 'Demo' },
    {
      email: 'manager.demo@honeygarden.local',
      role: 'CHATTER_MANAGER',
      firstName: 'Manager',
      lastName: 'Demo',
    },
    {
      email: 'chatter.demo@honeygarden.local',
      role: 'CHATTER',
      firstName: 'Chatter',
      lastName: 'Demo',
    },
  ];
  const demoPasswordHash = await bcrypt.hash('DemoPassword123!', 12);
  const demoUsers: Record<string, string> = {};
  for (const def of demoUsersDef) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: def.email } },
      update: {},
      create: {
        organizationId: organization.id,
        email: def.email,
        passwordHash: demoPasswordHash,
        firstName: def.firstName,
        lastName: def.lastName,
        roleId: roleIdByKey.get(def.role)!,
        emailVerifiedAt: new Date(),
      },
    });
    demoUsers[def.role] = user.id;
  }

  // 5. Creator demo (chiaramente identificabili, cancellabili)
  const demoCreatorsDef = [
    { stageName: 'Nayla (demo)', username: 'nayla_demo' },
    { stageName: 'Sweet (demo)', username: 'sweet_demo' },
  ];
  for (const def of demoCreatorsDef) {
    const existing = await prisma.creator.findFirst({
      where: { organizationId: organization.id, stageName: def.stageName },
    });
    const creator =
      existing ??
      (await prisma.creator.create({
        data: {
          organizationId: organization.id,
          stageName: def.stageName,
          status: 'ACTIVE',
          isDemo: true,
          tags: ['demo'],
          language: 'it',
          timezone: 'Europe/Rome',
        },
      }));

    await prisma.creatorAssignment.upsert({
      where: {
        creatorId_userId_role: {
          creatorId: creator.id,
          userId: demoUsers['CHATTER'],
          role: 'CHATTER',
        },
      },
      update: {},
      create: { creatorId: creator.id, userId: demoUsers['CHATTER'], role: 'CHATTER' },
    });
    await prisma.creatorAssignment.upsert({
      where: {
        creatorId_userId_role: {
          creatorId: creator.id,
          userId: demoUsers['CHATTER_MANAGER'],
          role: 'CHATTER_MANAGER',
        },
      },
      update: {},
      create: {
        creatorId: creator.id,
        userId: demoUsers['CHATTER_MANAGER'],
        role: 'CHATTER_MANAGER',
      },
    });

    const account = await prisma.onlyFansAccount.upsert({
      where: { creatorId_username: { creatorId: creator.id, username: def.username } },
      update: {},
      create: {
        creatorId: creator.id,
        displayName: def.stageName,
        username: def.username,
        provider: 'MANUAL',
        connectionStatus: 'NOT_CONFIGURED',
        syncStatus: 'NEVER_SYNCED',
      },
    });

    await prisma.aIProfile.upsert({
      where: { creatorId: creator.id },
      update: {},
      create: {
        creatorId: creator.id,
        mode: 'DISABLED',
        systemPrompt: 'Tono dolce e spontaneo. Vendita morbida, mai aggressiva.',
      },
    });

    // Fan demo + transazione demo per popolare la dashboard con dati reali (non finti in produzione)
    const fan = await prisma.fan.upsert({
      where: { organizationId_username: { organizationId: organization.id, username: `fan_${def.username}` } },
      update: {},
      create: {
        organizationId: organization.id,
        username: `fan_${def.username}`,
        displayName: 'Fan Demo',
        segment: 'subscriber',
      },
    });

    await prisma.fanCreatorLink.upsert({
      where: { fanId_creatorId_accountId: { fanId: fan.id, creatorId: creator.id, accountId: account.id } },
      update: {},
      create: {
        fanId: fan.id,
        creatorId: creator.id,
        accountId: account.id,
        subscriptionStatus: 'active',
        renewOn: true,
        subscribedAt: new Date(),
        totalSpent: 49.99,
        spentLast30Days: 49.99,
      },
    });

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        fanId: fan.id,
        type: 'SUBSCRIPTION',
        amountGross: 19.99,
        amountNet: 15.99,
        feeAmount: 4.0,
        currency: 'EUR',
      },
    });
  }

  console.log('Seed completato.');
  console.log('---------------------------------------------------');
  console.log(`Organizzazione: ${orgName}`);
  console.log(`Owner:          ${ownerEmail} / (password impostata da SEED_OWNER_PASSWORD)`);
  console.log('Utenti demo (password: DemoPassword123!):');
  demoUsersDef.forEach((u) => console.log(`  - ${u.role}: ${u.email}`));
  console.log('---------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
