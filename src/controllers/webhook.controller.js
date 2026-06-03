const webhookService = require('../services/webhook.service')
const { sendSuccess, sendError } = require('../utils/response')

function getStatusCode(error) {
  return error.statusCode || 500
}

async function handleSepayWebhook(req, res) {
  const expectedSecret = process.env.SEPAY_WEBHOOK_SECRET
  const providedSecret = req.headers['x-sepay-secret']

  if (!expectedSecret) {
    return sendError(res, 'SEPAY_WEBHOOK_SECRET chua duoc cau hinh', 500)
  }

  if (providedSecret !== expectedSecret) {
    return sendError(res, 'SePay secret khong hop le', 401)
  }

  try {
    const result = await webhookService.processSepayWebhook(req.body)
    return sendSuccess(res, result)
  } catch (err) {
    console.error('handleSepayWebhook error:', err)
    return sendError(res, err.message || 'Loi khi xu ly webhook SePay', getStatusCode(err))
  }
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
    return sendError(res, err.message || 'Loi khi gia lap SePay', getStatusCode(err))
  }
}

async function getSepayLogs(req, res) {
  try {
    const result = await webhookService.getSepayLogs(req.query)
    return sendSuccess(res, result)
  } catch (err) {
    console.error('getSepayLogs error:', err)
    return sendError(res, 'Loi khi lay log SePay', 500)
  }
}

module.exports = {
  handleSepayWebhook,
  simulateSepay,
  getSepayLogs,
}
