const prisma = require('../lib/prisma')

function truncateText(text, maxLength = 180) {
  if (!text || text.length <= maxLength) return text || ''
  return `${text.slice(0, maxLength - 3)}...`
}

function buildFeedbackNotificationMessage(data) {
  const senderParts = [data.senderName, data.senderEmail].filter(Boolean)
  const senderText = senderParts.length > 0 ? senderParts.join(' - ') : 'Ẩn danh'
  const preview = truncateText(data.message)

  return [
    `Tiêu đề: ${data.title}`,
    `Rating: ${data.rating}/5`,
    `Người gửi: ${senderText}`,
    `Nội dung: ${preview}`,
  ].join('\n')
}

async function sendFeedbackToAdmins(data) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })

  if (admins.length === 0) {
    return {
      adminCount: 0,
      notificationCount: 0,
      message: 'Không có admin để nhận feedback',
    }
  }

  const notificationMessage = buildFeedbackNotificationMessage(data)
  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: 'Feedback mới từ người dùng',
      message: notificationMessage,
      type: 'FEEDBACK',
      isRead: false,
    })),
  })

  return {
    adminCount: admins.length,
    notificationCount: admins.length,
    message: 'Feedback đã được gửi tới admin.',
  }
}

module.exports = {
  sendFeedbackToAdmins,
}
