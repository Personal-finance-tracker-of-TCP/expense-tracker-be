const prisma = require('../lib/prisma')

async function getPlatformStatistics() {
  const [
    totalUsers,
    totalTransactions,
    sepayProcessedCount,
    sepayUnmatchedCount,
    sepayFailedCount,
    linkedBankUsers,
    totalNotifications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.sepayLog.count({ where: { status: 'PROCESSED' } }),
    prisma.sepayLog.count({ where: { status: 'UNMATCHED' } }),
    prisma.sepayLog.count({ where: { status: 'FAILED' } }),
    prisma.user.count({
      where: {
        bankAccountNumber: {
          not: null,
        },
      },
    }),
    prisma.notification.count(),
  ])

  return {
    totalUsers,
    totalTransactions,
    sepayProcessedCount,
    sepayUnmatchedCount,
    sepayFailedCount,
    linkedBankUsers,
    totalNotifications,
    generatedAt: new Date().toISOString(),
  }
}

module.exports = {
  getPlatformStatistics,
}
