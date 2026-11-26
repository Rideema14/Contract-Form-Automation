import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_USERS = [
  {
    email: 'admin@example.com',
    password: 'admin123@#',
    fullName: 'Admin User',
    role: 'ADMIN' as const,
  },
  {
    email: 'approver@example.com',
    password: 'approver123@#',
    fullName: 'Approver User',
    role: 'APPROVER' as const,
  },
  {
    email: 'submitter@example.com',
    password: 'user123@#',
    fullName: 'Submitter User',
    role: 'SUBMITTER' as const,
  },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding demo users...\n');

  for (const demo of DEMO_USERS) {
    const hashedPassword = await bcrypt.hash(demo.password, 12);

    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {
        passwordHash: hashedPassword,
        fullName: demo.fullName,
        role: demo.role,
        isActive: true,
      },
      create: {
        email: demo.email,
        passwordHash: hashedPassword,
        fullName: demo.fullName,
        role: demo.role,
        isActive: true,
      },
    });

    console.log(`✅  ${demo.role.padEnd(10)} | ${user.email}  (password: ${demo.password})`);
  }

  console.log('\n✨ Done! All demo users are ready.');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
