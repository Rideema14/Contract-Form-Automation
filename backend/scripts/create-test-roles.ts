
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { loginSchema } from '../src/modules/auth/auth.validator';
import { prisma } from '../src/lib/prisma';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Only development environment is allowed.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');

  const host = new URL(databaseUrl).hostname.toLowerCase();
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error('Only localhost database is allowed.');
  }

  const accounts = [
    {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
      fullName: 'Local Test Admin',
      role: UserRole.ADMIN,
    },
    {
      email: process.env.TEST_APPROVER_EMAIL,
      password: process.env.TEST_APPROVER_PASSWORD,
      fullName: 'Local Test Approver',
      role: UserRole.APPROVER,
    },
  ];

  for (const account of accounts) {
    const parsed = loginSchema.safeParse({
      email: account.email,
      password: account.password,
    });

    if (!parsed.success) {
      throw new Error(`Invalid credentials configured for ${account.role}.`);
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      console.log(`${account.role} already exists. No changes made.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.create({
      data: {
        fullName: account.fullName,
        email: parsed.data.email,
        passwordHash,
        role: account.role,
        isActive: true,
      },
    });

    console.log(`${account.role} account created.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unable to create test accounts.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
