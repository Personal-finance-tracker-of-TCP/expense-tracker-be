const prisma = require('../lib/prisma')
const { sendSuccess, sendError } = require('../utils/response')

async function getNotifications(req, res) {
  const userId = req.user.userId

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return sendSuccess(res, notifications)
  } catch (error) {
    console.error('getNotifications error:', error)
    return sendError(res, 'Lỗi khi lấy danh sách thông báo', 500)
  }
}

async function readNotification(req, res) {
  const userId = req.user.userId
  const { id } = req.params

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return sendError(res, 'Không tìm thấy thông báo', 404)
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    return sendSuccess(res, updated)
  } catch (error) {
    console.error('readNotification error:', error)
    return sendError(res, 'Lỗi khi đánh dấu thông báo đã đọc', 500)
  }
}

async function readAllNotifications(req, res) {
  const userId = req.user.userId

  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })

    return sendSuccess(res, { message: 'Đã đánh dấu tất cả thông báo là đã đọc' })
  } catch (error) {
    console.error('readAllNotifications error:', error)
    return sendError(res, 'Lỗi khi đánh dấu tất cả thông báo', 500)
  }
}

module.exports = {
  getNotifications,
  readNotification,
  readAllNotifications,
}
