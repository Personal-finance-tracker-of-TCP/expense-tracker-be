const prisma = require('../lib/prisma')

const classifiedWhere = { classificationStatus: 'CLASSIFIED' }

// Helper: xác định khoảng thời gian từ query.
const getDateRange = (query = {}) => {
  const { from, to, month, year } = query

  if (from && to) {
    return {
      gte: new Date(from),
      lte: new Date(to)
    }
  }

  if (month && year) {
    const monthNumber = Number(month)
    const yearNumber = Number(year)

    return {
      gte: new Date(yearNumber, monthNumber - 1, 1),
      lt: new Date(yearNumber, monthNumber, 1)
    }
  }

  if (year) {
    const yearNumber = Number(year)

    return {
      gte: new Date(yearNumber, 0, 1),
      lt: new Date(yearNumber + 1, 0, 1)
    }
  }

  // Mặc định: tháng hiện tại.
  const now = new Date()

  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
  }
}

// Tổng hợp thu/chi/tiết kiệm trong kỳ.
const getSummary = async (userId, query) => {
  const dateRange = getDateRange(query)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      transactionDate: dateRange,
      ...classifiedWhere
    },
    select: {
      type: true,
      amount: true
    }
  })

  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'INCOME')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'EXPENSE')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  const savings = totalIncome - totalExpense

  return {
    totalIncome,
    totalExpense,
    savings,
    savingsRate:
      totalIncome > 0
        ? Math.round((savings / totalIncome) * 100)
        : 0
  }
}

// Dữ liệu biểu đồ thu/chi theo từng tháng 6 tháng gần nhất.
const getChartData = async (userId, query = {}) => {
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)

    return {
      month: date.getMonth() + 1,
      year: date.getFullYear()
    }
  }).reverse()

  const chartData = await Promise.all(
    months.map(async ({ month, year }) => {
      const dateRange = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1)
      }

      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          transactionDate: dateRange,
          ...classifiedWhere
        },
        select: {
          type: true,
          amount: true
        }
      })

      const income = transactions
        .filter((transaction) => transaction.type === 'INCOME')
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

      const expense = transactions
        .filter((transaction) => transaction.type === 'EXPENSE')
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

      return {
        month,
        year,
        income,
        expense
      }
    })
  )

  // Phân bổ chi tiêu theo danh mục.
  const dateRange = getDateRange(query)

  const categoryBreakdown = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'EXPENSE',
      transactionDate: dateRange,
      ...classifiedWhere
    },
    _sum: {
      amount: true
    },
    orderBy: {
      _sum: {
        amount: 'desc'
      }
    },
    take: 5
  })

  const categoryIds = categoryBreakdown
    .map((category) => category.categoryId)
    .filter(Boolean)

  const categories = await prisma.category.findMany({
    where: {
      id: {
        in: categoryIds
      }
    },
    select: {
      id: true,
      name: true,
      icon: true
    }
  })

  const breakdown = categoryBreakdown.map((categoryGroup) => {
    const category = categories.find((item) => item.id === categoryGroup.categoryId) || {
      name: 'Chưa phân loại',
      icon: ''
    }

    return {
      categoryId: categoryGroup.categoryId,
      name: category?.name || 'Không phân loại',
      icon: category?.icon || '',
      total: Number(categoryGroup._sum.amount || 0)
    }
  })

  return {
    chartData,
    categoryBreakdown: breakdown
  }
}

// Lấy data để xuất PDF/Excel.
const getExportData = async (userId, query) => {
  const dateRange = getDateRange(query)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      transactionDate: dateRange,
      ...classifiedWhere
    },
    include: {
      category: {
        select: {
          name: true,
          icon: true
        }
      }
    },
    orderBy: {
      transactionDate: 'desc'
    }
  })

  const summary = await getSummary(userId, query)

  const budgets = await prisma.budget.findMany({
    where: {
      userId
    },
    include: {
      category: {
        select: {
          name: true,
          icon: true
        }
      }
    }
  })

  return {
    transactions,
    summary,
    budgets,
    dateRange
  }
}

module.exports = {
  getDateRange,
  getSummary,
  getChartData,
  getExportData
}
