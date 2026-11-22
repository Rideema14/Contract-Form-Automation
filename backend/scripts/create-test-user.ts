import process from 'node:process';
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

interface TestUserDefinition {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

async function createOrUpdateUser(userDef: TestUserDefinition, defaultDepartmentId?: string): Promise<void> {
  const parsed = loginSchema.safeParse({
    email: userDef.email,
    password: userDef.password,
  });

  if (!parsed.success) {
    throw new Error(`Invalid credentials for ${userDef.email}: ${parsed.error.message}`);
  }

  const { email, password } = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 12);

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        fullName: userDef.fullName,
        role: userDef.role,
        isActive: true,
        departmentId: existingUser.departmentId ?? defaultDepartmentId,
      },
    });
    console.log(`- Verified/updated existing ${userDef.role} user: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        fullName: userDef.fullName,
        email,
        passwordHash,
        role: userDef.role,
        isActive: true,
        departmentId: defaultDepartmentId,
      },
    });
    console.log(`- Created new ${userDef.role} user: ${email}`);
  }
}

async function main(): Promise<void> {
  assertLocalDevelopmentDatabase();

  const defaultDepartment = await prisma.department.findFirst();
  const departmentId = defaultDepartment?.id;

  const usersToCreate: TestUserDefinition[] = [
    {
      fullName: 'Local Test Submitter',
      email: 'submitter@example.com',
      password: 'Password123!',
      role: UserRole.SUBMITTER,
    },
    {
      fullName: 'Local Test Approver',
      email: 'approver@example.com',
      password: 'Password123!',
      role: UserRole.APPROVER,
    },
    {
      fullName: 'Local Test Admin',
      email: 'admin@example.com',
      password: 'Password123!',
      role: UserRole.ADMIN,
    },
  ];

  const envEmail = process.env.TEST_USER_EMAIL?.trim();
  const envPassword = process.env.TEST_USER_PASSWORD?.trim();

  if (envEmail && envPassword) {
    const rawRole = (process.env.TEST_USER_ROLE?.trim().toUpperCase() || 'SUBMITTER') as UserRole;
    const role = Object.values(UserRole).includes(rawRole) ? rawRole : UserRole.SUBMITTER;

    const existingIndex = usersToCreate.findIndex((u) => u.email.toLowerCase() === envEmail.toLowerCase());
    const customUser: TestUserDefinition = {
      fullName: process.env.TEST_USER_NAME?.trim() || `Local Test ${role}`,
      email: envEmail,
      password: envPassword,
      role,
    };
    if (existingIndex >= 0) {
      usersToCreate[existingIndex] = customUser;
    } else {
      usersToCreate.push(customUser);
    }
  }

  console.log('--- Setting up Local Test Users ---');
  for (const userDef of usersToCreate) {
    await createOrUpdateUser(userDef, departmentId);
  }

  console.log('\n======================================================');
  console.log('           Local Test Users Ready to Use');
  console.log('======================================================');
  for (const userDef of usersToCreate) {
    console.log(`Role:     ${userDef.role}`);
    console.log(`Name:     ${userDef.fullName}`);
    console.log(`Email:    ${userDef.email}`);
    console.log(`Password: ${userDef.password}`);
    console.log('------------------------------------------------------');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unable to create local test user.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
