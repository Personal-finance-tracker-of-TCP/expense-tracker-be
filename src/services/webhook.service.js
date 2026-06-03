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
    message: 'transferType phai la IN hoac OUT'
  }),
  content: z
    .string({ message: 'content la bat buoc' })
    .trim()
    .min(1, 'content la bat buoc'),
  transactionDate: z
    .string({ message: 'transactionDate khong hop le' })
    .datetime({ message: 'transactionDate khong hop le' }),
})

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Payload SePay khong hop le'
}

function extractSepayCode(content) {
  const match = content.match(/\bMTU\d+\b/i)
  return match ? match[0].toUpperCase() : null
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function processSepayWebhook(payload) {
  const parsed = sepayPayloadSchema.safeParse(payload)
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
      transactionDate: new Date(data.transactionDate),
      processed: false,
    },
  })

  const sepayCode = extractSepayCode(data.content)
  if (!sepayCode) {
    return {
      status: 'UNMATCHED',
      message: 'Khong tim thay ma SePay trong noi dung chuyen khoan',
      log,
    }
  }

  const user = await prisma.user.findFirst({
    where: {
      sepayCode: {
        equals: sepayCode,
        mode: 'insensitive',
      },
    },
    select: { id: true, sepayCode: true },
  })

  if (!user) {
    return {
      status: 'UNMATCHED',
      message: 'Khong tim thay user tu noi dung chuyen khoan',
      sepayCode,
      log,
    }
  }

  const transactionType = data.transferType === 'IN' ? 'INCOME' : 'EXPENSE'
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
        transactionDate: new Date(data.transactionDate),
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
          increment: transactionType === 'INCOME'
            ? data.transferAmount
            : -data.transferAmount,
        },
      },
    })

    await tx.sepayLog.update({
      where: { id: log.id },
      data: {
        processed: true,
        transactionId: createdTransaction.id,
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
