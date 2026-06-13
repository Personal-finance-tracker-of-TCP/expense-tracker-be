const { PrismaClient } = require('@prisma/client')

const DEFAULT_CONNECTION_LIMIT = '1'
const DEFAULT_POOL_TIMEOUT = '30'
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM']
let isDisconnecting = false

function withDefaultConnectionLimit(databaseUrl) {
  if (!databaseUrl) return databaseUrl

  try {
    const parsed = new URL(databaseUrl)

    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set(
        'connection_limit',
        process.env.PRISMA_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT
      )
    }

    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set(
        'pool_timeout',
        process.env.PRISMA_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT
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

async function disconnectPrisma() {
  if (isDisconnecting) return
  isDisconnecting = true

  await prisma.$disconnect()
}

process.once('beforeExit', disconnectPrisma)

for (const signal of SHUTDOWN_SIGNALS) {
  process.once(signal, async () => {
    await disconnectPrisma()
    process.exit(0)
  })
}

module.exports = prisma
