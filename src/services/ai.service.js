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
    recommendations: suggestions.map((message) => ({ message })),
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

function getAdviceText(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return getAdviceText(value.message || value.text || value.content || value.description || value.advice)
}

function normalizeAdviceObjects(value) {
  const normalizeOne = (item, fallbackTitle) => {
    if (typeof item === 'string') {
      const message = item.trim()
      return message ? [{ title: fallbackTitle, message }] : []
    }

    if (typeof item === 'number' || typeof item === 'boolean') {
      return [{ title: fallbackTitle, message: String(item) }]
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) return []

    const title = getAdviceText(item.title || item.heading || item.name) || fallbackTitle
    const message = getAdviceText(item.message || item.text || item.content || item.description || item.advice)
    const severity = getAdviceText(item.severity || item.type || item.level)

    if (message) {
      return [{ title, message, ...(severity ? { severity } : {}) }]
    }

    return Object.entries(item).flatMap(([key, entryValue]) => normalizeOne(entryValue, key))
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeOne(item))
  }

  return normalizeOne(value)
}

function normalizeAdviceTexts(value) {
  return normalizeAdviceObjects(value)
    .map((item) => item.message)
    .filter(Boolean)
}

function getAiStatus() {
  const hasGeminiApiKey = Boolean(process.env.GEMINI_API_KEY)
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const hasFetch = typeof fetch === 'function'

  return {
    provider: 'GEMINI',
    model,
    configured: hasGeminiApiKey && hasFetch,
    hasGeminiApiKey,
    hasFetch,
  }
}

async function getGeminiErrorPayload(response) {
  const rawText = await response.text().catch(() => '')
  if (!rawText) return null

  try {
    return JSON.parse(rawText)
  } catch (error) {
    return rawText
  }
}

function getGeminiErrorMessage(payload) {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  return payload.error?.message || payload.message || JSON.stringify(payload)
}

function createGeminiApiError(response, payload) {
  const message = getGeminiErrorMessage(payload) || 'Gemini API call failed'
  const error = new Error(message)
  error.status = response.status
  error.statusText = response.statusText
  error.response = payload
  return error
}

function logGeminiError(context, error) {
  console.error(`${context}:`, {
    status: error.status,
    statusText: error.statusText,
    message: error.message,
    response: error.response,
  })
}

async function callGemini(summary) {
  const apiKey = process.env.GEMINI_API_KEY
  const hasGeminiApiKey = Boolean(apiKey)
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  console.log('Gemini advice config:', {
    hasGeminiApiKey,
    model,
    hasFetch: typeof fetch === 'function',
  })

  if (!hasGeminiApiKey || typeof fetch !== 'function') return null

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const prompt = [
    'You are a personal finance advisor for MoneyTrack.',
    'Return only JSON with keys: provider, summary, riskLevel, insights, recommendations, savingGoal.',
    'summary must be a short string.',
    'insights must be an array of objects: { "title": string, "message": string, "severity": "LOW" | "MEDIUM" | "HIGH" }.',
    'recommendations must be an array of objects: { "title": string, "message": string }.',
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

  if (!response.ok) {
    const payload = await getGeminiErrorPayload(response)
    throw createGeminiApiError(response, payload)
  }

  const body = await response.json()
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null

  const parsed = extractJsonObject(text)
  if (!parsed) return null

  const recommendations = normalizeAdviceObjects(parsed.recommendations || parsed.suggestions)

  return {
    ...parsed,
    summary,
    insights: normalizeAdviceObjects(parsed.insights),
    recommendations,
    suggestions: normalizeAdviceTexts(recommendations),
    source: 'gemini',
  }
}

async function getAdvice(userId, input = {}) {
  const summary = await getFinancialSummary(userId, input)
  const month = Number(input.month) || (new Date().getMonth() + 1)
  const year = Number(input.year) || new Date().getFullYear()
  const periodStr = `MONTH_${year}_${String(month).padStart(2, '0')}`

  let adviceResult = null
  let provider = 'RULE_BASED'

  try {
    const geminiAdvice = await callGemini(summary)
    if (geminiAdvice) {
      adviceResult = geminiAdvice
      provider = 'GEMINI'
    }
  } catch (err) {
    logGeminiError('Gemini advice error', err)
  }

  if (!adviceResult) {
    adviceResult = buildFallbackAdvice(summary)
    provider = 'RULE_BASED'
  }

  // Save advice to AiAdviceLog table
  try {
    await prisma.aiAdviceLog.create({
      data: {
        userId,
        period: periodStr,
        inputSummary: summary,
        result: {
          summary: typeof adviceResult.summary === 'string' ? adviceResult.summary : '',
          riskLevel: adviceResult.riskLevel,
          insights: adviceResult.insights,
          suggestions: adviceResult.suggestions,
          savingGoal: adviceResult.savingGoal,
        },
        provider,
      }
    })
  } catch (err) {
    console.error('Error saving AiAdviceLog:', err)
  }

  return {
    ...adviceResult,
    provider,
  }
}

async function getHistory(userId) {
  return prisma.aiAdviceLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
}

async function chat(userId, body = {}) {
  const { message, history, month, year } = body
  const summary = await getFinancialSummary(userId, { month, year })

  const apiKey = process.env.GEMINI_API_KEY
  const hasGeminiApiKey = Boolean(apiKey)
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  console.log('Gemini chat config:', {
    hasGeminiApiKey,
    model,
    hasFetch: typeof fetch === 'function',
  })

  if (!hasGeminiApiKey || typeof fetch !== 'function') {
    return {
      text: "Xin lỗi, tính năng chat AI chưa được cấu hình khóa API Gemini. Vui lòng kiểm tra lại cấu hình hệ thống.",
      source: "fallback"
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const prompt = [
    'You are a personal finance advisor for MoneyTrack.',
    'Provide a helpful, friendly, and concise answer in Vietnamese.',
    'Do not ask for personal identity details.',
    `Anonymized financial summary of the user for period ${summary.period}: ${JSON.stringify(summary)}.`,
    `Chat history: ${JSON.stringify(history || [])}`,
    `User message: ${message}`
  ].join('\n')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  if (!response.ok) {
    const payload = await getGeminiErrorPayload(response)
    const error = createGeminiApiError(response, payload)
    logGeminiError('Gemini chat error', error)
    throw error
  }

  const resBody = await response.json()
  const text = resBody?.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi từ AI."

  return {
    text,
    source: 'gemini'
  }
}

module.exports = {
  getAiStatus,
  getAdvice,
  getFinancialSummary,
  chat,
  getHistory,
}
