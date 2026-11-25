import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

prisma.user.findMany({
  where: { email: { in: ['admin@example.com', 'approver@example.com', 'submitter@example.com'] } },
  select: { email: true, role: true, isActive: true, fullName: true },
}).then((users) => {
  writeFileSync('db-check.json', JSON.stringify(users, null, 2));
  return prisma.$disconnect();
}).catch(async (e) => {
  writeFileSync('db-check.json', JSON.stringify({ error: String(e) }));
  await prisma.$disconnect();
  process.exit(1);
});
