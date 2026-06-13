const budgetService = require('../services/budget.service')
const { sendSuccess, sendError } = require('../utils/response')
const {
  createBudgetSchema,
  updateBudgetSchema,
} = require('../validators/budget.validator')

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Du lieu khong hop le'
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
    return sendError(res, 'Loi khi lay danh sach ngan sach', 500)
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
    return sendError(res, err.message || 'Loi khi tao ngan sach', getStatusCode(err))
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
      return sendError(res, 'Khong tim thay ngan sach hoac khong co quyen', 404)
    }

    return sendSuccess(res, budget)
  } catch (err) {
    console.error('updateBudget error:', err)
    return sendError(res, err.message || 'Loi khi cap nhat ngan sach', getStatusCode(err))
  }
}

async function deleteBudget(req, res) {
  try {
    const result = await budgetService.deleteBudget(req.user.userId, req.params.id)
    if (!result) {
      return sendError(res, 'Khong tim thay ngan sach hoac khong co quyen', 404)
    }

    return sendSuccess(res, { message: 'Xoa ngan sach thanh cong' })
  } catch (err) {
    console.error('deleteBudget error:', err)
    return sendError(res, 'Loi khi xoa ngan sach', 500)
  }
}

module.exports = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
}
