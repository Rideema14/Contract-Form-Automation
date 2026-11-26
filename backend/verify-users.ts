import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'approver@example.com', 'submitter@example.com'] } },
    select: { email: true, role: true, isActive: true },
  });

  const fs = await import('fs');
  fs.writeFileSync('verify-output.json', JSON.stringify(users, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  const fs = await import('fs');
  fs.writeFileSync('verify-output.json', JSON.stringify({ error: String(e) }));
  await prisma.$disconnect();
  process.exitCode = 1;
});
