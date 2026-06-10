const publicService = require('../services/public.service')
const { sendSuccess, sendError } = require('../utils/response')

async function getStatistics(req, res) {
  try {
    const statistics = await publicService.getPublicStatistics()
    return sendSuccess(res, statistics)
  } catch (error) {
    console.error('getStatistics error:', error.message)
    return sendError(res, 'Lỗi khi lấy thống kê public', 500)
  }
}

async function getHealth(req, res) {
  try {
    const health = await publicService.getPublicHealth()
    return sendSuccess(res, health)
  } catch (error) {
    console.error('getHealth error:', error.message)
    return sendError(res, 'Lỗi khi kiểm tra trạng thái hệ thống', 500)
  }
}

module.exports = {
  getStatistics,
  getHealth,
}
