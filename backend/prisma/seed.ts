import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function assertLocalDevelopmentDatabase(): void {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing to seed contract reference data unless NODE_ENV=development.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is invalid.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }

  if (!LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Refusing to seed contract reference data unless DATABASE_URL points to localhost.');
  }
}

async function main(): Promise<void> {
  assertLocalDevelopmentDatabase();

  const department = await prisma.department.upsert({
    where: { name: 'Strategic Sourcing' },
    update: {},
    create: { name: 'Strategic Sourcing' },
  });

  const contractCategory = await prisma.contractCategory.upsert({
    where: { name: 'Professional Services' },
    update: {},
    create: { name: 'Professional Services' },
  });

  const vendorType = await prisma.vendorType.upsert({
    where: { name: 'Technology Services' },
    update: {},
    create: { name: 'Technology Services' },
  });

  const currency = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: { name: 'United States Dollar' },
    create: { code: 'USD', name: 'United States Dollar' },
  });

  const vendors = await prisma.$transaction([
    prisma.vendor.upsert({
      where: { id: '00000000-0000-4000-8000-000000000001' },
      update: {
        name: 'Northstar Cloudworks',
        vendorTypeId: vendorType.id,
        contactDetails: {
          email: 'hello@northstar-cloudworks.example',
          phone: '+1-555-0101',
        },
      },
      create: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Northstar Cloudworks',
        vendorTypeId: vendorType.id,
        contactDetails: {
          email: 'hello@northstar-cloudworks.example',
          phone: '+1-555-0101',
        },
      },
    }),
    prisma.vendor.upsert({
      where: { id: '00000000-0000-4000-8000-000000000002' },
      update: {
        name: 'Blue Cedar Systems',
        vendorTypeId: vendorType.id,
        contactDetails: {
          email: 'contact@blue-cedar-systems.example',
          phone: '+1-555-0102',
        },
      },
      create: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Blue Cedar Systems',
        vendorTypeId: vendorType.id,
        contactDetails: {
          email: 'contact@blue-cedar-systems.example',
          phone: '+1-555-0102',
        },
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        department: { id: department.id, name: department.name },
        contractCategory: { id: contractCategory.id, name: contractCategory.name },
        vendorType: { id: vendorType.id, name: vendorType.name },
        currency: { id: currency.id, code: currency.code, name: currency.name },
        vendors: vendors.map((vendor) => ({
          id: vendor.id,
          name: vendor.name,
          vendorTypeId: vendor.vendorTypeId,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unable to seed contract reference data.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
