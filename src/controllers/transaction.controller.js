const transactionService = require('../services/transaction.service')
const { sendSuccess, sendError } = require('../utils/response')
const {
  createTransactionSchema,
  updateTransactionSchema,
  getTransactionsQuerySchema
} = require('../validators/transaction.validator')

function getValidationMessage(error) {
  return error.issues?.[0]?.message || 'Dữ liệu không hợp lệ'
}

async function getTransactions(req, res) {
  try {
    const parsed = getTransactionsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const result = await transactionService.getTransactions(req.user.userId, parsed.data)
    return sendSuccess(res, result)
  } catch (err) {
    console.error('getTransactions error:', err)
    return sendError(res, 'Lỗi khi lấy danh sách giao dịch', 500)
  }
}

async function getTransactionById(req, res) {
  try {
    const transaction = await transactionService.getTransactionById(req.user.userId, req.params.id)
    if (!transaction) return sendError(res, 'Không tìm thấy giao dịch', 404)
    return sendSuccess(res, transaction)
  } catch (err) {
    console.error('getTransactionById error:', err)
    return sendError(res, 'Lỗi khi lấy giao dịch', 500)
  }
}

async function createTransaction(req, res) {
  try {
    const parsed = createTransactionSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const transaction = await transactionService.createTransaction(req.user.userId, parsed.data)
    return sendSuccess(res, transaction, 201)
  } catch (err) {
    console.error('createTransaction error:', err)
    return sendError(res, 'Lỗi khi tạo giao dịch', 500)
  }
}

async function updateTransaction(req, res) {
  try {
    const parsed = updateTransactionSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, getValidationMessage(parsed.error), 400)
    }

    const transaction = await transactionService.updateTransaction(
      req.user.userId,
      req.params.id,
      parsed.data
    )
    if (!transaction) return sendError(res, 'Không tìm thấy giao dịch hoặc không có quyền', 403)
    return sendSuccess(res, transaction)
  } catch (err) {
    console.error('updateTransaction error:', err)
    return sendError(res, 'Lỗi khi cập nhật giao dịch', 500)
  }
}

async function deleteTransaction(req, res) {
  try {
    const result = await transactionService.deleteTransaction(req.user.userId, req.params.id)
    if (!result) return sendError(res, 'Không tìm thấy giao dịch hoặc không có quyền', 403)
    return sendSuccess(res, { message: 'Xoá giao dịch thành công' })
  } catch (err) {
    console.error('deleteTransaction error:', err)
    return sendError(res, 'Lỗi khi xoá giao dịch', 500)
  }
}

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
}
