import 'dotenv/config';
const process = (globalThis as typeof globalThis & {
  process: { env: Record<string, string | undefined>; exitCode?: number };
}).process;
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';
import { loginSchema } from '../src/modules/auth/auth.validator';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const EXPECTED_DATABASE_NAME = 'contract_automation';

class SafeSetupError extends Error {}

function getValidatedDatabaseUrl(): string {
  if (process.env.NODE_ENV !== 'development') {
    throw new SafeSetupError('Refusing to create a test user unless NODE_ENV=development.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new SafeSetupError('DATABASE_URL is required.');
  }

  let url: URL;
  let databaseName: string;
  try {
    url = new URL(databaseUrl);
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new SafeSetupError('DATABASE_URL is invalid.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new SafeSetupError('DATABASE_URL must use PostgreSQL.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    throw new SafeSetupError('Refusing to create a test user unless DATABASE_URL points to localhost.');
  }

  if (databaseName !== EXPECTED_DATABASE_NAME) {
    throw new SafeSetupError('Refusing to create a test user unless DATABASE_URL targets contract_automation.');
  }

  return databaseUrl;
}

function isLoopbackAddress(address: string | null): boolean {
  if (!address) return false;

  const [normalized, prefix, ...extraParts] = address.toLowerCase().split('/');
  if (extraParts.length > 0) return false;
  if (prefix !== undefined) {
    if (!/^(0|[1-9]\d*)$/.test(prefix)) return false;
    const prefixLength = Number(prefix);
    const maxPrefixLength = normalized.includes(':') ? 128 : 32;
    if (!Number.isSafeInteger(prefixLength) || prefixLength > maxPrefixLength) return false;
  }

  const isIpv4Loopback = (value: string): boolean => {
    const octets = value.split('.');
    return (
      octets.length === 4 &&
      octets.every((octet) => /^(0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255) &&
      octets[0] === '127'
    );
  };

  if (isIpv4Loopback(normalized)) return true;

  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    return true;
  }

  const mappedIpv4 = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  return Boolean(mappedIpv4 && isIpv4Loopback(mappedIpv4[1]));
}

async function main(): Promise<void> {
  const databaseUrl = getValidatedDatabaseUrl();
  const parsed = loginSchema.safeParse({
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
  });
  if (!parsed.success) {
    throw new SafeSetupError('TEST_USER_EMAIL and TEST_USER_PASSWORD must be valid environment variables.');
  }

  const { email, password } = parsed.data;
  if (password.length < 8 || password.length > 128) {
    throw new SafeSetupError('TEST_USER_PASSWORD must be between 8 and 128 characters.');
  }

  const role = process.env.TEST_USER_ROLE ?? UserRole.SUBMITTER;
  if (role !== UserRole.SUBMITTER && role !== UserRole.APPROVER) {
    throw new SafeSetupError('TEST_USER_ROLE must be SUBMITTER or APPROVER.');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const [databaseIdentity] = await tx.$queryRaw<
        Array<{ databaseName: string; schemaName: string; serverAddress: string | null }>
      >`SELECT
          current_database() AS "databaseName",
          current_schema() AS "schemaName",
          inet_server_addr()::text AS "serverAddress"`;

      if (
        databaseIdentity?.databaseName !== EXPECTED_DATABASE_NAME ||
        databaseIdentity.schemaName !== 'public' ||
        !isLoopbackAddress(databaseIdentity.serverAddress)
      ) {
        throw new SafeSetupError(
          'Refusing to create a test user unless PostgreSQL confirms the expected local database and schema.',
        );
      }

      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        console.log(`The local test user already exists with role ${existingUser.role}; no changes were made.`);
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await tx.user.create({
        data: {
          fullName: `Local Test ${role === UserRole.APPROVER ? 'Approver' : 'Submitter'}`,
          email,
          passwordHash,
          role,
          isActive: true,
        },
      });

      console.log(`Local ${role} test user created.`);
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof SafeSetupError
    ? error.message
    : 'Unable to create local test user due to an unexpected or database error.';
  console.error(message);
  process.exitCode = 1;
});
