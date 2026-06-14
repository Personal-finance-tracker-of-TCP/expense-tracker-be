const prisma = require('../lib/prisma')

async function getCategories(userId) {
  const [personalCategories, defaultCategories] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({
      where: { userId: null },
      orderBy: { name: 'asc' }
    })
  ])

  return [...personalCategories, ...defaultCategories]
}

async function createCategory(userId, data) {
  return prisma.category.create({
    data: {
      ...data,
      userId,
      isDefault: false
    }
  })
}

async function updateCategory(userId, categoryId, data) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId }
  })

  if (!category) return null

  return prisma.category.update({
    where: { id: categoryId },
    data
  })
}

async function deleteCategory(userId, categoryId) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId }
  })

  if (!category) return { error: 'NOT_FOUND' }

  const txCount = await prisma.transaction.count({
    where: { categoryId }
  })

  if (txCount > 0) return { error: 'HAS_TRANSACTIONS', count: txCount }

  await prisma.category.delete({ where: { id: categoryId } })
  return { success: true }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
}
