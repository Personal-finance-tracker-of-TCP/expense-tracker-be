const notificationService = require('../services/notification.service')
const { sendSuccess, sendError } = require('../utils/response')

function getStatusCode(error) {
  return error.statusCode || 500
}

async function getNotifications(req, res) {
  try {
    const notifications = await notificationService.getNotifications(req.user.userId)
    return sendSuccess(res, notifications)
  } catch (error) {
    console.error('getNotifications error:', error.message)
    return sendError(res, 'Lỗi khi lấy danh sách thông báo', 500)
  }
}

async function readNotification(req, res) {
  try {
    const updated = await notificationService.markNotificationRead(
      req.user.userId,
      req.params.id
    )

    return sendSuccess(res, updated)
  } catch (error) {
    console.error('readNotification error:', error.message)
    return sendError(
      res,
      error.message || 'Lỗi khi đánh dấu thông báo đã đọc',
      getStatusCode(error)
    )
  }
}

async function readAllNotifications(req, res) {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user.userId)
    return sendSuccess(res, result)
  } catch (error) {
    console.error('readAllNotifications error:', error.message)
    return sendError(res, 'Lỗi khi đánh dấu tất cả thông báo', 500)
  }
}

async function deleteNotification(req, res) {
  try {
    const result = await notificationService.deleteNotification(
      req.user.userId,
      req.params.id
    )

    return sendSuccess(res, result)
  } catch (error) {
    console.error('deleteNotification error:', error.message)
    return sendError(
      res,
      error.message || 'Lỗi khi xóa thông báo',
      getStatusCode(error)
    )
  }
}

module.exports = {
  getNotifications,
  readNotification,
  readAllNotifications,
  deleteNotification,
}
