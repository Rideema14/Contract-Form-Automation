const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name, checksum, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at
  `);

  console.table(migrations);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
