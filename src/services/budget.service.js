const prisma = require('../lib/prisma')

function getBudgetDateRange(budget) {
  if (budget.period === 'MONTHLY') {
    return {
      gte: new Date(budget.year, budget.month - 1, 1),
      lt: new Date(budget.year, budget.month, 1),
    }
  }

  return {
    gte: new Date(budget.year, 0, 1),
    lt: new Date(budget.year + 1, 0, 1),
  }
}

function normalizeBudgetData(data) {
  const normalized = { ...data }
  if (normalized.period === 'TOTAL') {
    normalized.month = null
  }
  return normalized
}

function getBudgetStatus(percentUsed) {
  if (percentUsed >= 100) return 'EXCEEDED'
  if (percentUsed >= 80) return 'WARNING'
  return 'SAFE'
}

async function ensureExpenseCategory(userId, categoryId) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [{ userId }, { userId: null }],
      type: { in: ['EXPENSE', 'BOTH'] },
    },
  })

  if (!category) {
    const error = new Error('Danh muc khong ton tai hoac khong dung loai chi tieu')
    error.statusCode = 400
    throw error
  }

  return category
}

async function ensureUniqueBudget(userId, data, budgetId) {
  const existing = await prisma.budget.findFirst({
    where: {
      userId,
      categoryId: data.categoryId,
      period: data.period,
      month: data.month ?? null,
      year: data.year,
      ...(budgetId ? { NOT: { id: budgetId } } : {}),
    },
  })

  if (existing) {
    const error = new Error('Ngan sach cho danh muc va ky nay da ton tai')
    error.statusCode = 409
    throw error
  }
}

async function attachBudgetComputedFields(budget) {
  const dateRange = getBudgetDateRange(budget)
  const aggregate = await prisma.transaction.aggregate({
    where: {
      userId: budget.userId,
      type: 'EXPENSE',
      categoryId: budget.categoryId,
      transactionDate: dateRange,
    },
    _sum: { amount: true },
  })

  const spentAmount = Number(aggregate._sum.amount || 0)
  const limitAmount = Number(budget.limitAmount)
  const remainingAmount = limitAmount - spentAmount
  const percentUsed = limitAmount > 0
    ? Math.round((spentAmount / limitAmount) * 10000) / 100
    : 0

  return {
    ...budget,
    limitAmount,
    spentAmount,
    remainingAmount,
    percentUsed,
    status: getBudgetStatus(percentUsed),
  }
}

async function getBudgets(userId) {
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: {
      category: {
        select: { id: true, name: true, icon: true, type: true },
      },
    },
    orderBy: [
      { year: 'desc' },
      { month: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return Promise.all(budgets.map(attachBudgetComputedFields))
}

async function createBudget(userId, data) {
  const normalized = normalizeBudgetData(data)

  await ensureExpenseCategory(userId, normalized.categoryId)
  await ensureUniqueBudget(userId, normalized)

  const budget = await prisma.budget.create({
    data: {
      userId,
      categoryId: normalized.categoryId,
      limitAmount: normalized.limitAmount,
      period: normalized.period,
      month: normalized.month ?? null,
      year: normalized.year,
    },
    include: {
      category: {
        select: { id: true, name: true, icon: true, type: true },
      },
    },
  })

  return attachBudgetComputedFields(budget)
}

async function updateBudget(userId, budgetId, data) {
  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
  })

  if (!existing) return null

  const merged = normalizeBudgetData({
    categoryId: data.categoryId ?? existing.categoryId,
    limitAmount: data.limitAmount ?? Number(existing.limitAmount),
    period: data.period ?? existing.period,
    month: data.month !== undefined ? data.month : existing.month,
    year: data.year ?? existing.year,
  })

  if (merged.period === 'MONTHLY' && !merged.month) {
    const error = new Error('MONTHLY yeu cau month tu 1 den 12')
    error.statusCode = 400
    throw error
  }

  await ensureExpenseCategory(userId, merged.categoryId)
  await ensureUniqueBudget(userId, merged, budgetId)

  const updated = await prisma.budget.update({
    where: { id: budgetId },
    data: {
      categoryId: merged.categoryId,
      limitAmount: merged.limitAmount,
      period: merged.period,
      month: merged.month ?? null,
      year: merged.year,
    },
    include: {
      category: {
        select: { id: true, name: true, icon: true, type: true },
      },
    },
  })

  return attachBudgetComputedFields(updated)
}

async function deleteBudget(userId, budgetId) {
  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
  })

  if (!existing) return null

  await prisma.budget.delete({ where: { id: budgetId } })
  return true
}

module.exports = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
}
