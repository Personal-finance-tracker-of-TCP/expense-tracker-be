const budgetService = require('../services/budget.service')
const { sendSuccess, sendError } = require('../utils/response')
const {
  createBudgetSchema,
  updateBudgetSchema,
} = require('../validators/budget.validator')

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Dữ liệu không hợp lệ'
}

function getStatusCode(error) {
  return error.statusCode || 500
}

async function getBudgets(req, res) {
  try {
    const budgets = await budgetService.getBudgets(req.user.userId)
    return sendSuccess(res, budgets)
  } catch (err) {
    console.error('getBudgets error:', err)
    return sendError(res, 'Lỗi khi lấy danh sách ngân sách', 500)
  }
}

async function createBudget(req, res) {
  try {
    const parsed = createBudgetSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const budget = await budgetService.createBudget(req.user.userId, parsed.data)
    return sendSuccess(res, budget, 201)
  } catch (err) {
    console.error('createBudget error:', err)
    return sendError(res, err.message || 'Lỗi khi tạo ngân sách', getStatusCode(err))
  }
}

async function updateBudget(req, res) {
  try {
    const parsed = updateBudgetSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const budget = await budgetService.updateBudget(
      req.user.userId,
      req.params.id,
      parsed.data
    )

    if (!budget) {
      return sendError(res, 'Không tìm thấy ngân sách hoặc không có quyền', 404)
    }

    return sendSuccess(res, budget)
  } catch (err) {
    console.error('updateBudget error:', err)
    return sendError(res, err.message || 'Lỗi khi cập nhật ngân sách', getStatusCode(err))
  }
}

async function deleteBudget(req, res) {
  try {
    const result = await budgetService.deleteBudget(req.user.userId, req.params.id)
    if (!result) {
      return sendError(res, 'Không tìm thấy ngân sách hoặc không có quyền', 404)
    }

    return sendSuccess(res, { message: 'Xóa ngân sách thành công' })
  } catch (err) {
    console.error('deleteBudget error:', err)
    return sendError(res, 'Lỗi khi xóa ngân sách', 500)
  }
}

module.exports = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
}
