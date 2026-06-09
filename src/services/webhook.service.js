const { z } = require('zod')
const prisma = require('../lib/prisma')

const sepayPayloadSchema = z.object({
  sepayId: z
    .string({ message: 'sepayId la bat buoc' })
    .trim()
    .min(1, 'sepayId la bat buoc'),
  gateway: z
    .string({ message: 'gateway la bat buoc' })
    .trim()
    .min(1, 'gateway la bat buoc'),
  transferAmount: z.coerce
    .number({ message: 'transferAmount phai la so' })
    .positive('transferAmount phai lon hon 0'),
  transferType: z.preprocess(
    (value) => (typeof value === 'string' ? value.toUpperCase() : value),
    z.enum(['IN', 'OUT'], {
      message: 'transferType phai la IN hoac OUT',
    })
  ),
  content: z.string().trim(),
  transactionDate: z.coerce.date({
    message: 'transactionDate khong hop le',
  }),
  accountNumber: z.string().optional(),
  referenceCode: z.string().optional(),
})

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Payload SePay khong hop le'
}

function normalizeOptionalText(value) {
  if (value === null || typeof value === 'undefined') return undefined

  const text = String(value).trim()
  return text.length > 0 ? text : undefined
}

function getStableSepayTransactionId(payload = {}) {
  const explicitSepayId = normalizeOptionalText(payload.sepayId)
  if (explicitSepayId) return explicitSepayId

  const referenceCode = normalizeOptionalText(payload.referenceCode)
  const id = payload.id === 0 ? '0' : normalizeOptionalText(payload.id)

  if (referenceCode && (!id || id === '0')) return referenceCode
  return id || referenceCode
}

function normalizeSepayPayload(payload = {}) {
  return {
    sepayId: getStableSepayTransactionId(payload),
    transactionDate: payload.transactionDate,
    accountNumber: normalizeOptionalText(payload.accountNumber),
    gateway: payload.gateway,
    transferType: payload.transferType,
    transferAmount: payload.transferAmount,
    content:
      normalizeOptionalText(payload.content) ||
      normalizeOptionalText(payload.description) ||
      '',
    referenceCode: normalizeOptionalText(payload.referenceCode),
  }
}

function extractSepayCode(content) {
  // Support both new MTKXXXXXX and legacy/demo MTUxxx formats.
  const match = content.match(/\b(MTK[A-Z0-9]{6}|MTU\d+)\b/i)
  return match ? match[0].toUpperCase() : null
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function processSepayWebhook(payload) {
  const normalizedPayload = normalizeSepayPayload(payload)
  const parsed = sepayPayloadSchema.safeParse(normalizedPayload)
  if (!parsed.success) {
    throw createServiceError(getValidationMessage(parsed.error), 400)
  }

  const data = parsed.data

  const duplicateLog = await prisma.sepayLog.findUnique({
    where: { sepayId: data.sepayId },
    include: {
      transaction: {
        select: {
          id: true,
          userId: true,
          type: true,
          amount: true,
          categoryId: true,
          source: true,
          sepayId: true,
        },
      },
    },
  })

  if (duplicateLog) {
    return {
      status: 'DUPLICATE',
      duplicate: true,
      message: 'SePay payload da duoc xu ly truoc do',
      log: duplicateLog,
      transaction: duplicateLog.transaction,
    }
  }

  const log = await prisma.sepayLog.create({
    data: {
      sepayId: data.sepayId,
      gateway: data.gateway,
      transferAmount: data.transferAmount,
      transferType: data.transferType,
      content: data.content,
      transactionDate: data.transactionDate,
      processed: false,
      rawPayload: payload || {},
    },
  })

  const sepayCode = extractSepayCode(data.content)
  let matchedCode = sepayCode
  let user = null

  if (sepayCode) {
    user = await prisma.user.findFirst({
      where: {
        sepayCode: {
          equals: sepayCode,
          mode: 'insensitive',
        },
      },
      select: { id: true, sepayCode: true, bankAccountNumber: true },
    })
  }

  if (!user && data.accountNumber) {
    user = await prisma.user.findFirst({
      where: {
        bankAccountNumber: data.accountNumber,
      },
      select: { id: true, sepayCode: true, bankAccountNumber: true },
    })
    matchedCode = matchedCode || user?.sepayCode || null
  }

  if (!user) {
    const updatedLog = await prisma.sepayLog.update({
      where: { id: log.id },
      data: {
        processed: false,
        status: 'UNMATCHED',
        errorReason: 'NO_MATCHING_USER',
        matchedCode,
      },
    })

    return {
      status: 'UNMATCHED',
      message: sepayCode
        ? 'Khong tim thay user tu noi dung chuyen khoan'
        : 'Khong tim thay ma SePay trong noi dung chuyen khoan',
      sepayCode,
      log: updatedLog,
    }
  }

  // Always register as INCOME as requested because it is money transferred into the system.
  const transactionType = 'INCOME'
  const transaction = await prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.transaction.create({
      data: {
        userId: user.id,
        categoryId: null,
        type: transactionType,
        amount: data.transferAmount,
        source: 'SEPAY',
        sepayId: data.sepayId,
        note: data.content,
        transactionDate: data.transactionDate,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true },
        },
      },
    })

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: {
          increment: data.transferAmount,
        },
      },
    })

    await tx.sepayLog.update({
      where: { id: log.id },
      data: {
        processed: true,
        status: 'PROCESSED',
        transactionId: createdTransaction.id,
        matchedCode,
      },
    })

    const amountFormatted = Number(data.transferAmount).toLocaleString('vi-VN')
    await tx.notification.create({
      data: {
        userId: user.id,
        title: 'Tu dong nhan tien qua SePay',
        message: `Tai khoan cua ban da nhan duoc +${amountFormatted}d qua SePay (noi dung chuyen khoan: "${data.content}").`,
        type: 'SEPAY_INCOME',
        isRead: false,
      },
    })

    return createdTransaction
  })

  return {
    status: 'PROCESSED',
    message: 'Xu ly SePay thanh cong',
    sepayCode,
    logId: log.id,
    transaction,
  }
}

async function getSepayLogs(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100)

  const [logs, total] = await Promise.all([
    prisma.sepayLog.findMany({
      orderBy: { transactionDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        transaction: {
          select: {
            id: true,
            userId: true,
            type: true,
            amount: true,
            categoryId: true,
            source: true,
            sepayId: true,
          },
        },
      },
    }),
    prisma.sepayLog.count(),
  ])

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

module.exports = {
  processSepayWebhook,
  getSepayLogs,
}
