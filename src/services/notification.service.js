const prisma = require('../lib/prisma')

async function getNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

async function markNotificationRead(userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  })

  if (!notification) {
    const error = new Error('Không tìm thấy thông báo')
    error.statusCode = 404
    throw error
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  })
}

async function markAllNotificationsRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })

  return {
    message: 'Đã đánh dấu tất cả thông báo là đã đọc',
    updatedCount: result.count,
  }
}

async function deleteNotification(userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  })

  if (!notification) {
    const error = new Error('Không tìm thấy thông báo')
    error.statusCode = 404
    throw error
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  })

  return {
    id: notificationId,
    deleted: true,
  }
}

async function createNotificationForUser(data) {
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  })

  if (!user) {
    const error = new Error('Không tìm thấy người dùng nhận thông báo')
    error.statusCode = 404
    throw error
  }

  return prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || 'ADMIN',
      isRead: false,
    },
  })
}

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotificationForUser,
}
