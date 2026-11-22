import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { loginSchema } from '../src/modules/auth/auth.validator';
import { prisma } from '../src/lib/prisma';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function assertLocalDevelopmentDatabase(): void {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing to create a test user unless NODE_ENV=development.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  let host: string;
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL is invalid.');
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error('Refusing to create a test user unless DATABASE_URL points to localhost.');
  }
}

async function main(): Promise<void> {
  assertLocalDevelopmentDatabase();

  const parsed = loginSchema.safeParse({
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be valid environment variables.');
  }

  const { email, password } = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log('The local test user already exists; no changes were made.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      fullName: 'Local Test Submitter',
      email,
      passwordHash,
      role: UserRole.SUBMITTER,
      isActive: true,
    },
  });

  console.log('Local Submitter test user created.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unable to create local test user.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
