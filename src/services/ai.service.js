const prisma = require('../lib/prisma')
const budgetService = require('./budget.service')

function getDateRange(input = {}) {
  const month = Number(input.month)
  const year = Number(input.year) || new Date().getFullYear()

  if (month >= 1 && month <= 12) {
    return {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
      label: `${month}/${year}`,
    }
  }

  return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
    label: `${year}`,
  }
}

function getSavingsRate(totalIncome, savings) {
  if (totalIncome <= 0) return 0
  return Math.round((savings / totalIncome) * 10000) / 100
}

async function getFinancialSummary(userId, input = {}) {
  const dateRange = getDateRange(input)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      transactionDate: {
        gte: dateRange.gte,
        lt: dateRange.lt,
      },
    },
    include: {
      category: {
        select: { id: true, name: true, icon: true },
      },
    },
  })

  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'INCOME')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'EXPENSE')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  const expenseByCategory = new Map()
  transactions
    .filter((transaction) => transaction.type === 'EXPENSE')
    .forEach((transaction) => {
      const key = transaction.categoryId || 'UNCLASSIFIED'
      const current = expenseByCategory.get(key) || {
        categoryId: transaction.categoryId,
        name: transaction.category?.name || 'Chua phan loai',
        icon: transaction.category?.icon || '\uD83D\uDCE6',
        amount: 0,
      }

      current.amount += Number(transaction.amount)
      expenseByCategory.set(key, current)
    })

  const budgets = await budgetService.getBudgets(userId)
  const overBudgetCategories = budgets
    .filter((budget) => budget.status === 'EXCEEDED')
    .map((budget) => ({
      categoryId: budget.categoryId,
      name: budget.category?.name,
      limitAmount: budget.limitAmount,
      spentAmount: budget.spentAmount,
      percentUsed: budget.percentUsed,
    }))

  const savings = totalIncome - totalExpense

  return {
    period: dateRange.label,
    totalIncome,
    totalExpense,
    savings,
    savingsRate: getSavingsRate(totalIncome, savings),
    topExpenseCategories: Array.from(expenseByCategory.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    overBudgetCategories,
    unclassifiedTransactionCount: transactions.filter((transaction) => !transaction.categoryId).length,
    sepayTransactionCount: transactions.filter((transaction) => transaction.source === 'SEPAY').length,
    manualTransactionCount: transactions.filter((transaction) => transaction.source === 'MANUAL').length,
  }
}

function getRiskLevel(summary) {
  if (summary.savings < 0 || summary.overBudgetCategories.length > 0) return 'HIGH'
  if (summary.savingsRate < 10 || summary.unclassifiedTransactionCount > 0) return 'MEDIUM'
  return 'LOW'
}

function buildFallbackAdvice(summary) {
  const insights = []
  const suggestions = []

  if (summary.totalIncome === 0) {
    insights.push('Chua co du lieu thu nhap trong ky nay.')
    suggestions.push('Them giao dich thu nhap de ty le tiet kiem phan anh dung hon.')
  }

  if (summary.savings < 0) {
    insights.push('Chi tieu dang cao hon thu nhap trong ky.')
    suggestions.push('Tam dung cac khoan chi khong thiet yeu va dat gioi han cho nhom chi lon nhat.')
  } else {
    insights.push(`Ty le tiet kiem hien tai la ${summary.savingsRate}%.`)
  }

  if (summary.topExpenseCategories.length > 0) {
    const topCategory = summary.topExpenseCategories[0]
    insights.push(`Nhom chi lon nhat la ${topCategory.name} voi ${topCategory.amount}.`)
    suggestions.push(`Kiem tra lai cac giao dich trong ${topCategory.name} de tim khoan co the cat giam.`)
  }

  if (summary.overBudgetCategories.length > 0) {
    suggestions.push('Mot so ngan sach da vuot han muc; hay dieu chinh han muc hoac giam chi trong phan con lai cua ky.')
  }

  if (summary.unclassifiedTransactionCount > 0) {
    suggestions.push('Phan loai cac giao dich SePay chua co danh muc de bao cao va ngan sach chinh xac hon.')
  }

  if (suggestions.length === 0) {
    suggestions.push('Duy tri thoi quen ghi nhan giao dich va tang muc tiet kiem them 5% neu dong tien on dinh.')
  }

  return {
    summary,
    riskLevel: getRiskLevel(summary),
    insights,
    suggestions,
    savingGoal: {
      targetRate: summary.savingsRate < 20 ? 20 : Math.min(summary.savingsRate + 5, 50),
      note: 'Dat muc tiet kiem muc tieu theo ty le thu nhap trong ky tiep theo.',
    },
    source: 'fallback',
  }
}

function extractJsonObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return JSON.parse(text.slice(start, end + 1))
}

async function callGemini(summary) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || typeof fetch !== 'function') return null

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const prompt = [
    'You are a personal finance advisor for MoneyTrack.',
    'Return only JSON with keys: summary, riskLevel, insights, suggestions, savingGoal.',
    'Use concise Vietnamese advice. Do not ask for personal identity details.',
    `Anonymized financial summary: ${JSON.stringify(summary)}`,
  ].join('\n')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) return null

  const body = await response.json()
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null

  const parsed = extractJsonObject(text)
  if (!parsed) return null

  return {
    ...parsed,
    summary,
    source: 'gemini',
  }
}

async function getAdvice(userId, input = {}) {
  const summary = await getFinancialSummary(userId, input)

  try {
    const geminiAdvice = await callGemini(summary)
    if (geminiAdvice) return geminiAdvice
  } catch (err) {
    console.error('Gemini advice error:', err)
  }

  return buildFallbackAdvice(summary)
}

module.exports = {
  getAdvice,
  getFinancialSummary,
}
