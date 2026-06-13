const prisma = require('../lib/prisma')

const CLASSIFICATION = {
  UNCLASSIFIED: 'UNCLASSIFIED',
  CLASSIFIED: 'CLASSIFIED',
  EXCLUDED: 'EXCLUDED',
}

const CLASSIFIED_ONLY_WHERE = {
  classificationStatus: CLASSIFICATION.CLASSIFIED,
}

function createHttpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function getBalanceDelta(type, amount) {
  const numericAmount = Number(amount)
  return type === 'INCOME' ? numericAmount : -numericAmount
}

async function getTransactions(userId, query) {
  const { month, year, type, categoryId, search, page, limit, classificationStatus } = query

  const where = { userId }

  // Filter theo tháng/năm
  if (month && year) {
    where.transactionDate = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1)
    }
  } else if (year) {
    where.transactionDate = {
      gte: new Date(year, 0, 1),
      lt: new Date(year + 1, 0, 1)
    }
  }

  if (type) where.type = type
  if (categoryId === CLASSIFICATION.UNCLASSIFIED) {
    where.classificationStatus = CLASSIFICATION.UNCLASSIFIED
  } else if (categoryId === CLASSIFICATION.EXCLUDED) {
    where.classificationStatus = CLASSIFICATION.EXCLUDED
  } else if (categoryId) {
    where.categoryId = categoryId
  }
  if (classificationStatus) where.classificationStatus = classificationStatus
  if (search) where.note = { contains: search, mode: 'insensitive' }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: { select: { id: true, name: true, icon: true } } },
      orderBy: { transactionDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.transaction.count({ where })
  ])

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
}

async function getOwnedTransactionOrThrow(userId, transactionId, options = {}) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    ...options,
  })

  if (!transaction) {
    throw createHttpError('Không tìm thấy giao dịch', 404)
  }

  if (transaction.userId !== userId) {
    throw createHttpError('Không có quyền truy cập giao dịch này', 403)
  }

  return transaction
}

async function getTransactionById(userId, transactionId) {
  return getOwnedTransactionOrThrow(userId, transactionId, {
    include: { category: { select: { id: true, name: true, icon: true } } }
  })
}

async function createTransaction(userId, data) {
  const { type, amount, categoryId, note, transactionDate } = data

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type,
        amount,
        categoryId,
        note,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        source: 'MANUAL',
        classificationStatus: CLASSIFICATION.CLASSIFIED,
      },
      include: { category: { select: { id: true, name: true, icon: true } } }
    })

    // Cập nhật balance: INCOME cộng, EXPENSE trừ
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: getBalanceDelta(type, amount)
        }
      }
    })

    return transaction
  })
}

async function updateTransaction(userId, transactionId, data) {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId }
  })

  if (!existing) return null

  const { type, amount, categoryId, note, transactionDate } = data

  return prisma.$transaction(async (tx) => {
    // Hoàn lại balance cũ
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: -getBalanceDelta(existing.type, existing.amount)
        }
      }
    })

    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: {
        ...(type && { type }),
        ...(amount && { amount }),
        ...(categoryId !== undefined && { categoryId }),
        ...(categoryId && { classificationStatus: CLASSIFICATION.CLASSIFIED }),
        ...(note !== undefined && { note }),
        ...(transactionDate && { transactionDate: new Date(transactionDate) })
      },
      include: { category: { select: { id: true, name: true, icon: true } } }
    })

    // Áp balance mới
    const newType = type ?? existing.type
    const newAmount = amount ?? Number(existing.amount)
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: getBalanceDelta(newType, newAmount)
        }
      }
    })

    return updated
  })
}

async function deleteTransaction(userId, transactionId) {
  const existing = await getOwnedTransactionOrThrow(userId, transactionId)

  return prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: transactionId } })

    // Hoàn lại balance
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: -getBalanceDelta(existing.type, existing.amount)
        }
      }
    })

    return true
  })
}

async function getRequesterRole(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  return user?.role || 'USER'
}

async function findTransactionForMutation(requesterId, transactionId) {
  const requesterRole = await getRequesterRole(requesterId)
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      ...(requesterRole === 'ADMIN' ? {} : { userId: requesterId }),
    },
  })

  return { transaction, requesterRole }
}

async function excludeTransaction(requesterId, transactionId) {
  const { transaction } = await findTransactionForMutation(requesterId, transactionId)

  if (!transaction) return null

  if (transaction.source !== 'SEPAY') {
    throw createHttpError('Chỉ giao dịch từ SePay mới có thể bỏ qua khỏi báo cáo.', 400)
  }

  return prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      classificationStatus: CLASSIFICATION.EXCLUDED,
    },
    include: { category: { select: { id: true, name: true, icon: true } } },
  })
}

async function classifyTransaction(requesterId, transactionId, data) {
  const { transaction } = await findTransactionForMutation(requesterId, transactionId)

  if (!transaction) return null

  const category = await prisma.category.findFirst({
    where: {
      id: data.categoryId,
      OR: [{ userId: transaction.userId }, { userId: null }],
      type: { in: [transaction.type, 'BOTH'] },
    },
    select: { id: true },
  })

  if (!category) {
    const error = new Error('Danh muc khong ton tai hoac khong phu hop loai giao dich')
    error.statusCode = 400
    throw error
  }

  return prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      categoryId: data.categoryId,
      classificationStatus: CLASSIFICATION.CLASSIFIED,
      ...(data.note !== undefined && { note: data.note }),
    },
    include: { category: { select: { id: true, name: true, icon: true } } },
  })
}

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  excludeTransaction,
  classifyTransaction,
  CLASSIFIED_ONLY_WHERE,
  CLASSIFICATION,
}
