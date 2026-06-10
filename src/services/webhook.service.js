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
  transferType: z.enum(['IN', 'OUT'], {
    message: 'transferType phai la IN hoac OUT',
  }),
  content: z.string().trim().default(''),
  codeSearchText: z.string().trim().default(''),
  transactionDate: z.coerce.date({
    message: 'transactionDate khong hop le',
  }),
  accountIdentity: z.string().optional(),
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

function pickFirstText(payload, keys) {
  for (const key of keys) {
    const value = normalizeOptionalText(payload?.[key])
    if (value) return value
  }

  return undefined
}

function getStableSepayTransactionId(payload = {}) {
  return pickFirstText(payload, [
    'transaction_id',
    'referenceCode',
    'reference_code',
    'sepayId',
    'id',
  ])
}

function normalizeTransferType(value) {
  const transferType = normalizeOptionalText(value)?.toLowerCase()

  if (transferType === 'credit' || transferType === 'in') return 'IN'
  if (transferType === 'debit' || transferType === 'out') return 'OUT'

  return undefined
}

function normalizeTransactionDate(payload = {}) {
  return (
    payload.transactionDate ||
    payload.transaction_date ||
    payload.transactionDateTime ||
    payload.created_at ||
    payload.createdAt ||
    new Date()
  )
}

function normalizeSepayPayload(payload = {}) {
  const content = normalizeOptionalText(payload.content)
  const description = normalizeOptionalText(payload.description)
  const transactionContent = normalizeOptionalText(payload.transaction_content)

  return {
    sepayId: getStableSepayTransactionId(payload),
    transactionDate: normalizeTransactionDate(payload),
    accountIdentity: pickFirstText(payload, [
      'bank_account_xid',
      'accountNumber',
      'account_number',
      'bank_account_number',
    ]),
    gateway:
      normalizeOptionalText(payload.gateway) ||
      normalizeOptionalText(payload.bank) ||
      normalizeOptionalText(payload.bank_name) ||
      'SePay BankHub Sandbox',
    transferType: normalizeTransferType(payload.transferType || payload.transfer_type),
    transferAmount: payload.transferAmount ?? payload.transfer_amount ?? payload.amount,
    content: content || description || transactionContent || '',
    codeSearchText: [content, description, transactionContent].filter(Boolean).join(' '),
    referenceCode: pickFirstText(payload, ['referenceCode', 'reference_code']),
  }
}

function extractSepayCode(text = '') {
  // Support both new MTKXXXXXX and legacy/demo MTUxxx formats.
  const match = text.match(/\b(MTK[A-Z0-9]{6}|MTU[A-Z0-9]{6}|MTU\d+)\b/i)
  return match ? match[0].toUpperCase() : null
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function findMatchedUser(data) {
  if (data.accountIdentity) {
    const user = await prisma.user.findFirst({
      where: {
        bankAccountNumber: data.accountIdentity,
      },
      select: { id: true, sepayCode: true, bankAccountNumber: true },
    })

    if (user) {
      return {
        user,
        sepayCode: null,
        matchedCode: user.sepayCode || null,
        matchType: 'BANK_ACCOUNT',
      }
    }
  }

  const sepayCode = extractSepayCode(data.codeSearchText || data.content)

  if (sepayCode) {
    const user = await prisma.user.findFirst({
      where: {
        sepayCode: {
          equals: sepayCode,
          mode: 'insensitive',
        },
      },
      select: { id: true, sepayCode: true, bankAccountNumber: true },
    })

    if (user) {
      return {
        user,
        sepayCode,
        matchedCode: sepayCode,
        matchType: 'SEPAY_CODE',
      }
    }
  }

  return {
    user: null,
    sepayCode,
    matchedCode: sepayCode,
    matchType: null,
  }
}

function getTransactionType(transferType) {
  return transferType === 'OUT' ? 'EXPENSE' : 'INCOME'
}

function getBalanceUpdate(transferType, amount) {
  return transferType === 'OUT' ? { decrement: amount } : { increment: amount }
}

function getNotificationCopy(transferType, amount, content) {
  const amountFormatted = Number(amount).toLocaleString('vi-VN')
  const directionText =
    transferType === 'OUT'
      ? `phat sinh giao dich -${amountFormatted}d qua SePay`
      : `nhan duoc +${amountFormatted}d qua SePay`

  return {
    title:
      transferType === 'OUT'
        ? 'Tu dong ghi nhan chi tien qua SePay'
        : 'Tu dong nhan tien qua SePay',
    message: `Tai khoan cua ban da ${directionText} (noi dung giao dich: "${content}").`,
    type: transferType === 'OUT' ? 'SEPAY_EXPENSE' : 'SEPAY_INCOME',
  }
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

  const { user, sepayCode, matchedCode, matchType } = await findMatchedUser(data)

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
      message: 'Khong tim thay user tu account identity hoac ma SePay',
      sepayCode,
      accountIdentity: data.accountIdentity || null,
      log: updatedLog,
    }
  }

  const transactionType = getTransactionType(data.transferType)
  const notification = getNotificationCopy(
    data.transferType,
    data.transferAmount,
    data.content
  )

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
        balance: getBalanceUpdate(data.transferType, data.transferAmount),
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

    await tx.notification.create({
      data: {
        userId: user.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: false,
      },
    })

    return createdTransaction
  })

  return {
    status: 'PROCESSED',
    message: 'Xu ly SePay thanh cong',
    sepayCode,
    accountIdentity: data.accountIdentity || null,
    matchType,
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
