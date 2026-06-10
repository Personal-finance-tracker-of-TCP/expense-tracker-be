const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Testing Supabase connection...");

  const result = await prisma.$queryRaw`SELECT current_database() AS db, current_user AS user, now() AS time`;

  console.log("Connected successfully:");
  console.log(result);
}

main()
  .catch((error) => {
    console.error("Connection failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
