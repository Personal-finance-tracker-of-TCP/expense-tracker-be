const categoryService = require('../services/category.service')
const { sendSuccess, sendError } = require('../utils/response')
const { createCategorySchema, updateCategorySchema } = require('../validators/category.validator')

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Dữ liệu không hợp lệ'
}

async function getCategories(req, res) {
  try {
    const categories = await categoryService.getCategories(req.user.userId)
    return sendSuccess(res, categories)
  } catch (err) {
    return sendError(res, 'Lỗi khi lấy danh mục', 500)
  }
}

async function createCategory(req, res) {
  try {
    const parsed = createCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const category = await categoryService.createCategory(req.user.userId, parsed.data)
    return sendSuccess(res, category, 201)
  } catch (err) {
    console.error('createCategory error:', err) // thêm dòng này
    return sendError(res, err.message || 'Lỗi khi tạo danh mục', 500)
  }
}

async function updateCategory(req, res) {
  try {
    const parsed = updateCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const category = await categoryService.updateCategory(
      req.user.userId,
      req.params.id,
      parsed.data
    )

    if (!category) return sendError(res, 'Không tìm thấy danh mục hoặc không có quyền', 403)

    return sendSuccess(res, category)
  } catch (err) {
    return sendError(res, 'Lỗi khi cập nhật danh mục', 500)
  }
}

async function deleteCategory(req, res) {
  try {
    const result = await categoryService.deleteCategory(req.user.userId, req.params.id)

    if (result.error === 'NOT_FOUND') {
      return sendError(res, 'Không tìm thấy danh mục hoặc không có quyền', 403)
    }

    if (result.error === 'HAS_TRANSACTIONS') {
      return sendError(
        res,
        `Danh mục đang có ${result.count} giao dịch liên kết, không thể xoá`,
        400
      )
    }

    return sendSuccess(res, { message: 'Xoá danh mục thành công' })
  } catch (err) {
    return sendError(res, 'Lỗi khi xoá danh mục', 500)
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
}
