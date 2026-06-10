const aiService = require('../services/ai.service')
const { sendSuccess, sendError } = require('../utils/response')

function getSafeAiErrorMessage(err, fallbackMessage) {
  const parts = []

  if (err.status) {
    parts.push(`status ${err.status}`)
  }

  if (err.message) {
    parts.push(err.message)
  }

  return parts.length > 0 ? `${fallbackMessage}: ${parts.join(' - ')}` : fallbackMessage
}

async function getAdvice(req, res) {
  try {
    const advice = await aiService.getAdvice(req.user.userId, req.body || {})
    return sendSuccess(res, advice)
  } catch (err) {
    console.error('getAdvice error:', err)
    return sendError(res, 'Loi khi tao goi y tai chinh', 500)
  }
}

async function getStatus(req, res) {
  try {
    return sendSuccess(res, aiService.getAiStatus())
  } catch (err) {
    console.error('getAiStatus error:', err)
    return sendError(res, getSafeAiErrorMessage(err, 'Loi khi kiem tra cau hinh AI'), 500)
  }
}

async function chat(req, res) {
  try {
    console.log('AI chat request:', {
      userId: req.user?.userId,
      hasMessage: Boolean(req.body?.message),
      historyLength: Array.isArray(req.body?.history) ? req.body.history.length : 0,
      month: req.body?.month,
      year: req.body?.year,
    })

    const response = await aiService.chat(req.user.userId, req.body || {})
    return sendSuccess(res, response)
  } catch (err) {
    console.error('chat error:', {
      status: err.status,
      statusText: err.statusText,
      message: err.message,
      response: err.response,
    })
    return sendError(res, getSafeAiErrorMessage(err, 'Loi khi chat voi AI'), err.status || 500)
  }
}

async function getHistory(req, res) {
  try {
    const history = await aiService.getHistory(req.user.userId)
    return sendSuccess(res, history)
  } catch (err) {
    console.error('getHistory error:', err)
    return sendError(res, 'Loi khi lay lich su AI', 500)
  }
}

module.exports = {
  getAdvice,
  getStatus,
  chat,
  getHistory,
}
