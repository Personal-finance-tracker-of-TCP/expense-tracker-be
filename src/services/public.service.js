const prisma = require('../lib/prisma')

async function getPublicStatistics() {
  const [
    totalUsers,
    totalTransactions,
    processedSepayTransactions,
    totalCategories,
    totalBudgets,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.sepayLog.count({
      where: {
        status: 'PROCESSED',
      },
    }),
    prisma.category.count(),
    prisma.budget.count(),
  ])

  return {
    totalUsers,
    totalTransactions,
    processedSepayTransactions,
    totalCategories,
    totalBudgets,
    generatedAt: new Date().toISOString(),
  }
}

async function getPublicHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return {
      status: 'ok',
      message: 'MoneyTrack API is running',
      database: 'ok',
      checkedAt: new Date().toISOString(),
    }
  } catch {
    return {
      status: 'degraded',
      message: 'MoneyTrack API is running, database health check failed',
      database: 'unavailable',
      checkedAt: new Date().toISOString(),
    }
  }
}

module.exports = {
  getPublicStatistics,
  getPublicHealth,
}
