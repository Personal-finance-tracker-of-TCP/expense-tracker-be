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
  accountXid: z.string().optional(),
  accountNumber: z.string().optional(),
  referenceCode: z.string().optional(),
})

const sepayBankhubPayloadSchema = z.object({
  transactionId: z
    .string({ message: 'transaction_id la bat buoc' })
    .trim()
    .min(1, 'transaction_id la bat buoc'),
  gateway: z.string().trim().default('SePay BankHub'),
  transactionDate: z.date({ message: 'transaction_date khong hop le' }),
  accountNumber: z.string().trim().optional(),
  bankAccountXid: z.string().trim().optional(),
  transferType: z.enum(['credit', 'debit'], {
    message: 'transfer_type chi nhan credit hoac debit',
  }),
  amount: z.coerce
    .number({ message: 'amount phai la so' })
    .positive('amount phai lon hon 0'),
  content: z.string().trim().optional(),
  referenceCode: z.string().trim().optional(),
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

function parseBankhubTransactionDate(value) {
  if (!value) return new Date()

  if (value instanceof Date) return value

  const text = String(value).trim()
  const vnDateTimeMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  )

  if (vnDateTimeMatch) {
    return new Date(`${vnDateTimeMatch[1]}-${vnDateTimeMatch[2]}-${vnDateTimeMatch[3]}T${vnDateTimeMatch[4]}:${vnDateTimeMatch[5]}:${vnDateTimeMatch[6]}+07:00`)
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function normalizeSepayPayload(payload = {}) {
  const content = normalizeOptionalText(payload.content)
  const description = normalizeOptionalText(payload.description)
  const transactionContent = normalizeOptionalText(payload.transaction_content)

  return {
    sepayId: getStableSepayTransactionId(payload),
    transactionDate: normalizeTransactionDate(payload),
    accountXid: pickFirstText(payload, [
      'bank_account_xid',
      'bankhubAccountXid',
      'bankHubAccountXid',
      'account_xid',
      'xid',
    ]),
    accountNumber: pickFirstText(payload, [
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

function normalizeSepayBankhubPayload(payload = {}) {
  return {
    transactionId: pickFirstText(payload, ['transaction_id']),
    gateway: normalizeOptionalText(payload.gateway) || 'SePay BankHub',
    transactionDate: parseBankhubTransactionDate(
      payload.transaction_date || payload.transactionDate
    ),
    accountNumber: pickFirstText(payload, [
      'account_number',
      'accountNumber',
      'bank_account_number',
    ]),
    bankAccountXid: pickFirstText(payload, [
      'bank_account_xid',
      'bankhubAccountXid',
      'bankHubAccountXid',
    ]),
    transferType: normalizeOptionalText(payload.transfer_type || payload.transferType)?.toLowerCase(),
    amount: payload.amount,
    content: normalizeOptionalText(payload.content),
    referenceCode: pickFirstText(payload, ['reference_code', 'referenceCode']),
  }
}

function normalizeBankhubEventName(value) {
  return normalizeOptionalText(value)?.toUpperCase()
}

function isBankhubLifecyclePayload(payload = {}) {
  return Boolean(normalizeBankhubEventName(payload.event) && payload.metadata)
}

function normalizeBankhubLifecyclePayload(payload = {}) {
  const metadata = payload.metadata || {}
  const event = normalizeBankhubEventName(payload.event)
  const timestamp = Number(payload.timestamp)
  const transactionDate =
    Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp * 1000)
      : new Date()

  return {
    event,
    metadata,
    sepayId:
      pickFirstText(payload, ['xid', 'id']) ||
      [
        event,
        pickFirstText(metadata, ['link_session_xid', 'link_token_xid', 'bank_account_xid']),
      ]
        .filter(Boolean)
        .join(':'),
    transactionDate,
    bankAccountXid: pickFirstText(metadata, [
      'bank_account_xid',
      'bankhubAccountXid',
      'bankHubAccountXid',
    ]),
    accountNumber: pickFirstText(metadata, [
      'account_number',
      'accountNumber',
      'bank_account_number',
    ]),
    brandName: pickFirstText(metadata, ['brand_name', 'bank_name', 'bankName']),
    unlinked:
      metadata.unlinked === true ||
      String(metadata.unlinked).toLowerCase() === 'true',
    state: normalizeOptionalText(metadata.state),
  }
}

function isBankhubUnlinkCompletedEvent(data) {
  if (data.event === 'LINK_SESSION_COMPLETED' && data.unlinked) return true

  return ['BANK_ACCOUNT_UNLINKED', 'BANK_ACCOUNT_INACTIVED'].some((eventName) =>
    data.event?.includes(eventName)
  )
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

function getBankhubTransferType(transferType) {
  return transferType === 'debit' ? 'OUT' : 'IN'
}

function getBankhubTransactionType(transferType) {
  return transferType === 'debit' ? 'EXPENSE' : 'INCOME'
}

async function findMatchedUser(data) {
  if (data.accountXid) {
    const user = await prisma.user.findFirst({
      where: {
        bankhubAccountXid: data.accountXid,
      },
      select: { id: true, sepayCode: true, bankhubAccountXid: true, bankAccountNumber: true },
    })

    if (user) {
      return {
        user,
        sepayCode: null,
        matchedCode: user.bankhubAccountXid || null,
        matchType: 'BANKHUB_XID',
      }
    }
  }

  if (data.accountNumber) {
    const user = await prisma.user.findFirst({
      where: {
        bankAccountNumber: data.accountNumber,
      },
      select: { id: true, sepayCode: true, bankhubAccountXid: true, bankAccountNumber: true },
    })

    if (user) {
      return {
        user,
        sepayCode: null,
        matchedCode: user.bankAccountNumber || null,
        matchType: 'BANK_ACCOUNT_NUMBER',
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
      select: { id: true, sepayCode: true, bankhubAccountXid: true, bankAccountNumber: true },
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
    matchedCode: data.accountXid || data.accountNumber || sepayCode || null,
    matchType: null,
  }
}

async function findBankhubIpnUser(data) {
  if (data.bankAccountXid && prisma.bankConnection?.findFirst) {
    try {
      const bankConnection = await prisma.bankConnection.findFirst({
        where: { externalId: data.bankAccountXid },
      })

      if (bankConnection?.userId) {
        const user = await prisma.user.findUnique({
          where: { id: bankConnection.userId },
          select: {
            id: true,
            bankhubAccountXid: true,
            bankAccountNumber: true,
          },
        })

        if (user) {
          return {
            user,
            matchedCode: data.bankAccountXid,
            matchType: 'BANK_CONNECTION',
          }
        }
      }
    } catch (error) {
      console.warn('findBankhubIpnUser BankConnection lookup skipped:', error.message)
    }
  }

  if (data.bankAccountXid) {
    const user = await prisma.user.findFirst({
      where: { bankhubAccountXid: data.bankAccountXid },
      select: { id: true, bankhubAccountXid: true, bankAccountNumber: true },
    })

    if (user) {
      return {
        user,
        matchedCode: data.bankAccountXid,
        matchType: 'USER_BANKHUB_XID',
      }
    }
  }

  if (data.accountNumber) {
    const user = await prisma.user.findFirst({
      where: { bankAccountNumber: data.accountNumber },
      select: { id: true, bankhubAccountXid: true, bankAccountNumber: true },
    })

    if (user) {
      return {
        user,
        matchedCode: data.accountNumber,
        matchType: 'USER_BANK_ACCOUNT_NUMBER',
      }
    }
  }

  return {
    user: null,
    matchedCode: data.bankAccountXid || data.accountNumber || null,
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
        ? 'Tự động ghi nhận chi tiền qua SePay'
        : 'Tự  động nhận tiền qua SePay',
    message: `Tài khoản của bạn đã ${directionText} (nội dung giao dịch: "${content}"). Giao dich dang cho ban phan loai trong danh sach giao dich.`,
    type: transferType === 'OUT' ? 'SEPAY_EXPENSE' : 'SEPAY_INCOME',
  }
}

async function upsertBankhubWebhookLog(data, payload, status = 'PENDING') {
  const transferType = getBankhubTransferType(data.transferType)
  const content = data.content || data.referenceCode || ''

  return prisma.sepayLog.upsert({
    where: { sepayId: data.transactionId },
    update: {
      gateway: data.gateway,
      transferAmount: data.amount,
      transferType,
      content,
      transactionDate: data.transactionDate,
      rawPayload: payload || {},
      status,
      processed: status === 'PROCESSED',
      errorReason: null,
      matchedCode: data.bankAccountXid || data.accountNumber || null,
    },
    create: {
      sepayId: data.transactionId,
      gateway: data.gateway,
      transferAmount: data.amount,
      transferType,
      content,
      transactionDate: data.transactionDate,
      rawPayload: payload || {},
      status,
      processed: status === 'PROCESSED',
      matchedCode: data.bankAccountXid || data.accountNumber || null,
    },
  })
}

async function upsertBankhubLifecycleLog(data, payload, status = 'PROCESSED') {
  const contentParts = [
    `BankHub event: ${data.event}`,
    data.state ? `state=${data.state}` : null,
    data.unlinked ? 'unlinked=true' : null,
  ].filter(Boolean)

  return prisma.sepayLog.upsert({
    where: { sepayId: data.sepayId },
    update: {
      gateway: data.brandName || 'SePay BankHub',
      transferAmount: 0,
      transferType: 'OUT',
      content: contentParts.join('; '),
      transactionDate: data.transactionDate,
      rawPayload: payload || {},
      status,
      processed: status === 'PROCESSED' || status === 'DUPLICATE',
      errorReason: null,
      matchedCode: data.bankAccountXid || data.accountNumber || null,
    },
    create: {
      sepayId: data.sepayId,
      gateway: data.brandName || 'SePay BankHub',
      transferAmount: 0,
      transferType: 'OUT',
      content: contentParts.join('; '),
      transactionDate: data.transactionDate,
      rawPayload: payload || {},
      status,
      processed: status === 'PROCESSED' || status === 'DUPLICATE',
      matchedCode: data.bankAccountXid || data.accountNumber || null,
    },
  })
}

async function processBankhubLifecycleWebhook(payload) {
  const data = normalizeBankhubLifecyclePayload(payload)

  if (!data.event || !data.sepayId) {
    throw createServiceError('Payload BankHub lifecycle khong hop le', 400)
  }

  const duplicateLog = await prisma.sepayLog.findUnique({
    where: { sepayId: data.sepayId },
    select: { id: true, status: true, processed: true },
  })

  if (duplicateLog?.processed || duplicateLog?.status === 'PROCESSED') {
    await upsertBankhubLifecycleLog(data, payload, 'DUPLICATE')

    return {
      event: data.event,
      status: 'DUPLICATE',
      duplicated: true,
    }
  }

  const log = await upsertBankhubLifecycleLog(data, payload, 'PENDING')

  if (!isBankhubUnlinkCompletedEvent(data)) {
    const updatedLog = await prisma.sepayLog.update({
      where: { id: log.id },
      data: {
        status: 'PROCESSED',
        processed: true,
      },
    })

    return {
      event: data.event,
      status: 'PROCESSED',
      logId: updatedLog.id,
    }
  }

  if (!data.bankAccountXid && !data.accountNumber) {
    const updatedLog = await prisma.sepayLog.update({
      where: { id: log.id },
      data: {
        status: 'UNMATCHED',
        processed: true,
        errorReason: 'BankHub unlink event missing bank account identity',
      },
    })

    return {
      event: data.event,
      status: 'UNMATCHED',
      message: 'Missing bank account identity for BankHub unlink event',
      logId: updatedLog.id,
    }
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        data.bankAccountXid ? { bankhubAccountXid: data.bankAccountXid } : undefined,
        data.accountNumber ? { bankAccountNumber: data.accountNumber } : undefined,
      ].filter(Boolean),
    },
    select: {
      id: true,
      bankhubAccountXid: true,
      bankAccountNumber: true,
      bankName: true,
    },
  })

  if (!user) {
    const updatedLog = await prisma.sepayLog.update({
      where: { id: log.id },
      data: {
        status: 'UNMATCHED',
        processed: true,
        errorReason: 'BankHub unlink event user mapping not found',
        matchedCode: data.bankAccountXid || data.accountNumber || null,
      },
    })

    return {
      event: data.event,
      status: 'UNMATCHED',
      message: 'User mapping not found for BankHub unlink event',
      logId: updatedLog.id,
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        bankhubAccountXid: null,
        bankAccountNumber: null,
        bankName: null,
        bankAccountName: null,
        sepayLinkedAt: null,
      },
    })

    await tx.sepayLog.update({
      where: { id: log.id },
      data: {
        status: 'PROCESSED',
        processed: true,
        matchedCode: data.bankAccountXid || data.accountNumber || null,
      },
    })

    await tx.notification.create({
      data: {
        userId: user.id,
        title: 'Đã hủy liên kết BankHub Sandbox',
        message:
          'Tài khoản BankHub Sandbox đã được hủy liên kết thành công. Lịch sử giao dịch trước đó vẫn được giữ lại.',
        type: 'BANKHUB_UNLINKED',
        isRead: false,
      },
    })
  })

  return {
    event: data.event,
    status: 'PROCESSED',
    unlinked: true,
    userId: user.id,
  }
}

async function processSepayBankhubWebhook(payload) {
  if (isBankhubLifecyclePayload(payload)) {
    return processBankhubLifecycleWebhook(payload)
  }

  const normalizedPayload = normalizeSepayBankhubPayload(payload)
  const parsed = sepayBankhubPayloadSchema.safeParse(normalizedPayload)

  if (!parsed.success) {
    throw createServiceError(getValidationMessage(parsed.error), 400)
  }

  const data = parsed.data
  const content = data.content || data.referenceCode || ''
  const transferType = getBankhubTransferType(data.transferType)
  const transactionType = getBankhubTransactionType(data.transferType)

  const existingTransaction = await prisma.transaction.findUnique({
    where: { sepayId: data.transactionId },
    select: {
      id: true,
      userId: true,
      type: true,
      amount: true,
      categoryId: true,
      source: true,
      sepayId: true,
    },
  })

  const log = await upsertBankhubWebhookLog(
    data,
    payload,
    existingTransaction ? 'DUPLICATE' : 'PENDING'
  )

  if (existingTransaction) {
    await prisma.sepayLog.update({
      where: { id: log.id },
      data: {
        processed: true,
        status: 'DUPLICATE',
        transactionId: log.transactionId || existingTransaction.id,
      },
    })

    return {
      duplicated: true,
      transaction: existingTransaction,
    }
  }

  const { user, matchedCode, matchType } = await findBankhubIpnUser(data)

  if (!user) {
    await prisma.sepayLog.update({
      where: { id: log.id },
      data: {
        processed: false,
        status: 'UNMATCHED',
        errorReason: 'User mapping not found',
        matchedCode,
      },
    })

    return {
      message: 'User mapping not found',
    }
  }

  const notification = getNotificationCopy(transferType, data.amount, content)

  const transaction = await prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.transaction.create({
      data: {
        userId: user.id,
        amount: data.amount,
        type: transactionType,
        source: 'SEPAY',
        note: content,
        transactionDate: data.transactionDate,
        sepayId: data.transactionId,
        categoryId: null,
        classificationStatus: 'UNCLASSIFIED',
      },
    })

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: getBalanceUpdate(transferType, data.amount),
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
    processed: true,
    matchType,
    transaction,
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

  if (duplicateLog?.transactionId || duplicateLog?.status === 'PROCESSED') {
    return {
      status: 'DUPLICATE',
      duplicate: true,
      message: 'SePay payload da duoc xu ly truoc do',
      log: duplicateLog,
      transaction: duplicateLog.transaction,
    }
  }

  const log = duplicateLog
    ? await prisma.sepayLog.update({
        where: { id: duplicateLog.id },
        data: {
          gateway: data.gateway,
          transferAmount: data.transferAmount,
          transferType: data.transferType,
          content: data.content,
          transactionDate: data.transactionDate,
          processed: false,
          status: 'PENDING',
          errorReason: null,
          rawPayload: payload || {},
        },
      })
    : await prisma.sepayLog.create({
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
      accountXid: data.accountXid || null,
      accountNumber: data.accountNumber || null,
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
        classificationStatus: 'UNCLASSIFIED',
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
    accountXid: data.accountXid || null,
    accountNumber: data.accountNumber || null,
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
  processSepayBankhubWebhook,
  getSepayLogs,
}
