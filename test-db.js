const prisma = require('./src/lib/prisma');
const jwt = require('./src/utils/jwt');

// Load env variables if any
require('dotenv').config();

async function test() {
  console.log("Fetching users from DB...");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sepayCode: true,
      balance: true
    }
  });
  console.log("Users:", JSON.stringify(users, null, 2));

  if (users.length > 0) {
    const user = users[0];
    const token = jwt.generateAccessToken(user.id);
    console.log(`\nGenerated access token for ${user.email} (${user.id}):`);
    console.log(token);
  }
}

test()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
