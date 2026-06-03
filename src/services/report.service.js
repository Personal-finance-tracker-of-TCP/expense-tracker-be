const prisma = require('../lib/prisma')

// Helper: xác định khoảng thời gian từ query
const getDateRange = (query) => {
  const { from, to, month, year } = query
  if (from && to) return { gte: new Date(from), lte: new Date(to) }
  if (month && year) return {
    gte: new Date(year, month - 1, 1),
    lt: new Date(year, month, 1)
  }
  if (year) return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1)
  }
  // Mặc định: tháng hiện tại
  const now = new Date()
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
  }
}

// Tổng hợp thu/chi/tiết kiệm trong kỳ
const getSummary = async (userId, query) => {
  const dateRange = getDateRange(query)

  const transactions = await prisma.transaction.findMany({
    where: { userId, transactionDate: dateRange },
    select: { type: true, amount: true }
  })

  const totalIncome = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpense = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return {
    totalIncome,
    totalExpense,
    savings: totalIncome - totalExpense,
    savingsRate: totalIncome > 0
      ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
      : 0
  }
}

// Dữ liệu biểu đồ thu/chi theo từng tháng (6 tháng gần nhất)
const getChartData = async (userId, query) => {
  const { year } = query
  const currentYear = year || new Date().getFullYear()

  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    return { month: date.getMonth() + 1, year: date.getFullYear() }
  }).reverse()

  const chartData = await Promise.all(
    months.map(async ({ month, year }) => {
      const dateRange = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1)
      }

      const transactions = await prisma.transaction.findMany({
        where: { userId, transactionDate: dateRange },
        select: { type: true, amount: true }
      })

      const income = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + Number(t.amount), 0)

      const expense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + Number(t.amount), 0)

      return { month, year, income, expense }
    })
  )

  // Phân bổ chi tiêu theo danh mục
  const dateRange = getDateRange(query)
  const categoryBreakdown = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: 'EXPENSE', transactionDate: dateRange },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 5
  })

  const categoryIds = categoryBreakdown
    .map(c => c.categoryId)
    .filter(Boolean)
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true }
  })

  const breakdown = categoryBreakdown.map(c => {
    const cat = categories.find(cat => cat.id === c.categoryId) || {
      name: 'Ch\u01b0a ph\u00e2n lo\u1ea1i',
      icon: '\uD83D\uDCE6'
    }
    return {
      categoryId: c.categoryId,
      name: cat?.name || 'Không phân loại',
      icon: cat?.icon || '📦',
      total: Number(c._sum.amount)
    }
  })

  return { chartData, categoryBreakdown: breakdown }
}

// Lấy data để xuất PDF/Excel
const getExportData = async (userId, query) => {
  const dateRange = getDateRange(query)

  const transactions = await prisma.transaction.findMany({
    where: { userId, transactionDate: dateRange },
    include: { category: { select: { name: true, icon: true } } },
    orderBy: { transactionDate: 'desc' }
  })

  const summary = await getSummary(userId, query)

  return { transactions, summary, dateRange }
}

module.exports = {
  getSummary,
  getChartData,
  getExportData,
}
