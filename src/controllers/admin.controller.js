const prisma = require('../lib/prisma')
const webhookService = require('../services/webhook.service')
const { sendSuccess, sendError } = require('../utils/response')

function getStatusCode(error) {
  return error.statusCode || 500
}

async function simulateSepay(req, res) {
  try {
    const payload = {
      ...req.body,
      sepayId: req.body?.sepayId || `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }

    const result = await webhookService.processSepayWebhook(payload)
    return sendSuccess(res, result, result.status === 'PROCESSED' ? 201 : 200)
  } catch (err) {
    console.error('simulateSepay error:', err)
    return sendError(res, err.message || 'Lỗi khi giả lập SePay', getStatusCode(err))
  }
}

async function getSepayLogs(req, res) {
  try {
    const result = await webhookService.getSepayLogs(req.query)
    return sendSuccess(res, result)
  } catch (err) {
    console.error('getSepayLogs error:', err)
    return sendError(res, 'Lỗi khi lấy log SePay', 500)
  }
}

async function getLinkedUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      where: {
        sepayCode: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        sepayCode: true,
        sepayLinkedAt: true,
        role: true,
      },
      orderBy: {
        sepayLinkedAt: 'desc',
      },
    })

    return sendSuccess(res, users)
  } catch (error) {
    console.error('getLinkedUsers error:', error)
    return sendError(res, 'Lỗi khi lấy danh sách người dùng liên kết', 500)
  }
}

module.exports = {
  simulateSepay,
  getSepayLogs,
  getLinkedUsers,
}
