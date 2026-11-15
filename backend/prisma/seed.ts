
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER' },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  console.log('USER and ADMIN roles are ready.');

  const adminName = process.env.ADMIN_NAME;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  const credentialsProvided = Boolean(
    adminName || adminEmail || adminPassword
  );

  if (!credentialsProvided) {
    console.log('Admin account skipped. No credentials configured.');
    return;
  }

  if (!adminName || !adminEmail || !adminPassword) {
    throw new Error(
      'Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD together.'
    );
  }

  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('Admin email already exists. Existing account unchanged.');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      roleId: adminRole.id,
    },
  });

  console.log('Initial Admin account created.');
}

main()
  .catch((error: unknown) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
