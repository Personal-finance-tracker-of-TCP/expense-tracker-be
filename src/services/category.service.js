import prisma from '../lib/prisma.js'

// Lấy danh mục hệ thống + danh mục cá nhân của user
export const getCategories = async (userId) => {
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
export const createCategory = async (userId, data) => {
  return prisma.category.create({
    data: {
      ...data,
      userId,
      isDefault: false
    }
  })
}

// Cập nhật danh mục — chỉ cho sửa danh mục của chính mình
export const updateCategory = async (userId, categoryId, data) => {
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
export const deleteCategory = async (userId, categoryId) => {
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