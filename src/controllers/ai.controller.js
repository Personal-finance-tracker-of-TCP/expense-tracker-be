const aiService = require('../services/ai.service')
const { sendSuccess, sendError } = require('../utils/response')

async function getAdvice(req, res) {
  try {
    const advice = await aiService.getAdvice(req.user.userId, req.body || {})
    return sendSuccess(res, advice)
  } catch (err) {
    console.error('getAdvice error:', err)
    return sendError(res, 'Loi khi tao goi y tai chinh', 500)
  }
}

module.exports = {
  getAdvice,
}
