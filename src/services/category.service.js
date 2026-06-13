const prisma = require('../lib/prisma')

// Lấy danh mục hệ thống + danh mục cá nhân của user
async function getCategories(userId) {
  return prisma.category.findMany({
    where: {
      OR: [
        { userId: null },   // danh mục mặc định hệ thống
        { userId }          // danh mục cá nhân
      ]
    },
    orderBy: [
      { isDefault: 'desc' }, // mặc định hiện trước
      { name: 'asc' }
    ]
  })
}

// Tạo danh mục cá nhân
async function createCategory(userId, data) {
  return prisma.category.create({
    data: {
      ...data,
      userId,
      isDefault: false
    }
  })
}

// Cập nhật danh mục — chỉ cho sửa danh mục của chính mình
async function updateCategory(userId, categoryId, data) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId } // userId phải khớp, không sửa được danh mục hệ thống
  })

  if (!category) return null

  return prisma.category.update({
    where: { id: categoryId },
    data
  })
}

// Xoá danh mục — kiểm tra còn giao dịch liên kết không
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
