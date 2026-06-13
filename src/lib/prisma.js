const { PrismaClient } = require('@prisma/client')

function withDefaultConnectionLimit(databaseUrl) {
  if (!databaseUrl) return databaseUrl

  try {
    const parsed = new URL(databaseUrl)

    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set(
        'connection_limit',
        process.env.PRISMA_CONNECTION_LIMIT || '5'
      )
    }

    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set(
        'pool_timeout',
        process.env.PRISMA_POOL_TIMEOUT || '20'
      )
    }

    return parsed.toString()
  } catch {
    return databaseUrl
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = withDefaultConnectionLimit(process.env.DATABASE_URL)
}

const globalForPrisma = globalThis
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

process.once('beforeExit', async () => {
  await prisma.$disconnect()
})

module.exports = prisma
