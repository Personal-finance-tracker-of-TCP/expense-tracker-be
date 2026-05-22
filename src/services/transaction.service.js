import prisma from '../lib/prisma.js'

export const getTransactions = async (userId, query) => {
  const { month, year, type, categoryId, search, page, limit } = query

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
  if (categoryId) where.categoryId = categoryId
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

export const getTransactionById = async (userId, transactionId) => {
  return prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    include: { category: { select: { id: true, name: true, icon: true } } }
  })
}

export const createTransaction = async (userId, data) => {
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
        source: 'MANUAL'
      },
      include: { category: { select: { id: true, name: true, icon: true } } }
    })

    // Cập nhật balance: INCOME cộng, EXPENSE trừ
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: type === 'INCOME' ? amount : -amount
        }
      }
    })

    return transaction
  })
}

export const updateTransaction = async (userId, transactionId, data) => {
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
          increment: existing.type === 'INCOME' ? -existing.amount : Number(existing.amount)
        }
      }
    })

    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: {
        ...(type && { type }),
        ...(amount && { amount }),
        ...(categoryId && { categoryId }),
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
          increment: newType === 'INCOME' ? newAmount : -newAmount
        }
      }
    })

    return updated
  })
}

export const deleteTransaction = async (userId, transactionId) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId }
  })

  if (!existing) return null

  return prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: transactionId } })

    // Hoàn lại balance
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: existing.type === 'INCOME' ? -existing.amount : Number(existing.amount)
        }
      }
    })

    return true
  })
}