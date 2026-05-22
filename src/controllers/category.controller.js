import * as categoryService from '../services/category.service.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator.js'

export const getCategories = async (req, res) => {
  try {
    const categories = await categoryService.getCategories(req.user.id)
    return sendSuccess(res, categories)
  } catch (err) {
    return sendError(res, 'Lỗi khi lấy danh mục', 500)
  }
}

export const createCategory = async (req, res) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0].message, 400)
    }

    const category = await categoryService.createCategory(req.user.id, parsed.data)
    return sendSuccess(res, category, 201)
  } catch (err) {
    return sendError(res, 'Lỗi khi tạo danh mục', 500)
  }
}

export const updateCategory = async (req, res) => {
  try {
    const parsed = updateCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0].message, 400)
    }

    const category = await categoryService.updateCategory(
      req.user.id,
      req.params.id,
      parsed.data
    )

    if (!category) return sendError(res, 'Không tìm thấy danh mục hoặc không có quyền', 403)

    return sendSuccess(res, category)
  } catch (err) {
    return sendError(res, 'Lỗi khi cập nhật danh mục', 500)
  }
}

export const deleteCategory = async (req, res) => {
  try {
    const result = await categoryService.deleteCategory(req.user.id, req.params.id)

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