const prisma = require('../lib/prisma')

function truncateText(text, maxLength = 180) {
  if (!text || text.length <= maxLength) return text || ''
  return `${text.slice(0, maxLength - 3)}...`
}

function buildFeedbackNotificationMessage(data) {
  const senderParts = [data.senderName, data.senderEmail].filter(Boolean)
  const senderText = senderParts.length > 0 ? senderParts.join(' - ') : 'Nguoi dung'
  const preview = truncateText(data.message)

  return [
    `Tieu de: ${data.title}`,
    `Loai: ${data.type || 'OTHER'}`,
    data.rating ? `Danh gia: ${data.rating}/5` : null,
    `Nguoi gui: ${senderText}`,
    `Noi dung: ${preview}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function notifyAdmins(data) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })

  if (admins.length === 0) {
    return {
      adminCount: 0,
      notificationCount: 0,
      message: 'Khong co admin de nhan phan hoi',
    }
  }

  const notificationMessage = buildFeedbackNotificationMessage(data)
  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: 'Phan hoi moi tu nguoi dung',
      message: notificationMessage,
      type: 'FEEDBACK',
      isRead: false,
    })),
  })

  return {
    adminCount: admins.length,
    notificationCount: admins.length,
    message: 'Phan hoi da duoc gui toi admin.',
  }
}

async function createFeedback(data) {
  const feedback = await prisma.feedback.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || 'OTHER',
      rating: data.rating || null,
      status: 'NEW',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  })

  const notificationResult = await notifyAdmins(data)

  return {
    feedback,
    ...notificationResult,
  }
}

async function listFeedback() {
  return prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  })
}

async function updateFeedbackStatus(id, status) {
  return prisma.feedback.update({
    where: { id },
    data: { status },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  })
}

module.exports = {
  createFeedback,
  listFeedback,
  updateFeedbackStatus,
}
