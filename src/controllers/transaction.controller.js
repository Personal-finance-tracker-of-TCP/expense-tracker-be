import * as transactionService from '../services/transaction.service.js'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  createTransactionSchema,
  updateTransactionSchema,
  getTransactionsQuerySchema
} from '../validators/transaction.validator.js'

export const getTransactions = async (req, res) => {
  try {
    const parsed = getTransactionsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0].message, 400)
    }

    const result = await transactionService.getTransactions(req.user.id, parsed.data)
    return sendSuccess(res, result)
  } catch (err) {
    console.error('getTransactions error:', err)
    return sendError(res, 'Lỗi khi lấy danh sách giao dịch', 500)
  }
}

export const getTransactionById = async (req, res) => {
  try {
    const transaction = await transactionService.getTransactionById(req.user.id, req.params.id)
    if (!transaction) return sendError(res, 'Không tìm thấy giao dịch', 404)
    return sendSuccess(res, transaction)
  } catch (err) {
    console.error('getTransactionById error:', err)
    return sendError(res, 'Lỗi khi lấy giao dịch', 500)
  }
}

export const createTransaction = async (req, res) => {
  try {
    const parsed = createTransactionSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0].message, 400)
    }

    const transaction = await transactionService.createTransaction(req.user.id, parsed.data)
    return sendSuccess(res, transaction, 201)
  } catch (err) {
    console.error('createTransaction error:', err)
    return sendError(res, 'Lỗi khi tạo giao dịch', 500)
  }
}

export const updateTransaction = async (req, res) => {
  try {
    const parsed = updateTransactionSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0].message, 400)
    }

    const transaction = await transactionService.updateTransaction(
      req.user.id,
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

export const deleteTransaction = async (req, res) => {
  try {
    const result = await transactionService.deleteTransaction(req.user.id, req.params.id)
    if (!result) return sendError(res, 'Không tìm thấy giao dịch hoặc không có quyền', 403)
    return sendSuccess(res, { message: 'Xoá giao dịch thành công' })
  } catch (err) {
    console.error('deleteTransaction error:', err)
    return sendError(res, 'Lỗi khi xoá giao dịch', 500)
  }
}