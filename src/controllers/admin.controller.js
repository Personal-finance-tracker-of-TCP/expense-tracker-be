const prisma = require('../lib/prisma')
const { z } = require('zod')
const adminService = require('../services/admin.service')
const bankHubService = require('../services/bankhub.service')
const feedbackService = require('../services/feedback.service')
const notificationService = require('../services/notification.service')
const webhookService = require('../services/webhook.service')
const { sendSuccess, sendError } = require('../utils/response')

const bankHubSandboxTransactionSchema = z.object({
  userId: z
    .string({ message: 'userId la bat buoc' })
    .trim()
    .min(1, 'userId la bat buoc'),
  transferType: z.enum(['credit', 'debit'], {
    message: 'transferType chi nhan credit hoac debit',
  }),
  amount: z.coerce
    .number({ message: 'amount phai la so' })
    .positive('amount phai lon hon 0'),
  content: z
    .string({ message: 'content phai la chuoi' })
    .trim()
    .min(1, 'content la bat buoc')
    .max(255, 'content toi da 255 ky tu'),
})

const adminCreateNotificationSchema = z.object({
  userId: z
    .string({ message: 'userId la bat buoc' })
    .trim()
    .min(1, 'userId la bat buoc'),
  title: z
    .string({ message: 'title la bat buoc' })
    .trim()
    .min(1, 'title la bat buoc')
    .max(100, 'title toi da 100 ky tu'),
  message: z
    .string({ message: 'message la bat buoc' })
    .trim()
    .min(1, 'message la bat buoc')
    .max(500, 'message toi da 500 ky tu'),
  type: z
    .string()
    .trim()
    .max(50, 'type toi da 50 ky tu')
    .optional(),
})

const assignBankhubAccountSchema = z.object({
  bankhubAccountXid: z
    .string({ message: 'bankhubAccountXid la bat buoc' })
    .trim()
    .min(1, 'bankhubAccountXid la bat buoc')
    .max(128, 'bankhubAccountXid toi da 128 ky tu'),
  bankAccountNumber: z.string().trim().max(64).optional().nullable(),
  bankName: z.string().trim().max(64).optional().nullable(),
  bankAccountName: z.string().trim().max(128).optional().nullable(),
})

const updateFeedbackStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'], {
    message: 'status khong hop le',
  }),
})

function getStatusCode(error) {
  return error.statusCode || 500
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
      select: {
        id: true,
        name: true,
        email: true,
        sepayCode: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return sendSuccess(res, users)
  } catch (error) {
    console.error('getLinkedUsers error:', error)
    return sendError(res, 'Lỗi khi lấy danh sách người dùng liên kết', 500)
  }
}

async function getPlatformStatistics(req, res) {
  try {
    const statistics = await adminService.getPlatformStatistics()
    return sendSuccess(res, statistics)
  } catch (error) {
    console.error('getPlatformStatistics error:', error.message)
    return sendError(res, 'Lỗi khi lấy thống kê nền tảng', 500)
  }
}

async function createNotification(req, res) {
  const parsed = adminCreateNotificationSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Du lieu thong bao khong hop le',
      400
    )
  }

  try {
    const notification = await notificationService.createNotificationForUser(
      parsed.data
    )
    return sendSuccess(res, notification, 201)
  } catch (error) {
    console.error('createNotification error:', error.message)
    return sendError(
      res,
      error.message || 'Lỗi khi tạo thông báo',
      getStatusCode(error)
    )
  }
}

async function getNotifications(req, res) {
  try {
    const notifications = await prisma.notification.findMany({
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

    return sendSuccess(res, notifications)
  } catch (error) {
    console.error('getNotifications error:', error.message)
    return sendError(res, 'Lỗi khi lấy danh sách thông báo', 500)
  }
}

async function getFeedback(req, res) {
  try {
    const feedback = await feedbackService.listFeedback()
    return sendSuccess(res, feedback)
  } catch (error) {
    console.error('getFeedback error:', error.message)
    return sendError(res, 'Loi khi lay danh sach phan hoi', 500)
  }
}

async function updateFeedbackStatus(req, res) {
  const parsed = updateFeedbackStatusSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Du lieu trang thai khong hop le',
      400
    )
  }

  try {
    const feedback = await feedbackService.updateFeedbackStatus(
      req.params.id,
      parsed.data.status
    )
    return sendSuccess(res, feedback)
  } catch (error) {
    console.error('updateFeedbackStatus error:', error.message)
    return sendError(
      res,
      error.code === 'P2025' ? 'Khong tim thay phan hoi' : error.message,
      error.code === 'P2025' ? 404 : getStatusCode(error)
    )
  }
}

async function markNotificationRead(req, res) {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
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

    return sendSuccess(res, notification)
  } catch (error) {
    console.error('markNotificationRead error:', error.message)
    return sendError(
      res,
      error.code === 'P2025' ? 'Khong tim thay thong bao' : error.message,
      error.code === 'P2025' ? 404 : getStatusCode(error)
    )
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    const result = await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })

    return sendSuccess(res, {
      updatedCount: result.count,
    })
  } catch (error) {
    console.error('markAllNotificationsRead error:', error.message)
    return sendError(res, 'Lỗi khi đánh dấu tất cả thông báo', 500)
  }
}

async function assignBankhubAccount(req, res) {
  const parsed = assignBankhubAccountSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Du lieu tai khoan BankHub khong hop le',
      400
    )
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        bankhubAccountXid: parsed.data.bankhubAccountXid,
        bankAccountNumber: parsed.data.bankAccountNumber || null,
        bankName: parsed.data.bankName || null,
        bankAccountName: parsed.data.bankAccountName || null,
        sepayLinkedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
      },
    })

    return sendSuccess(res, updatedUser)
  } catch (error) {
    console.error('assignBankhubAccount error:', error.message)
    return sendError(
      res,
      error.code === 'P2025' ? 'Khong tim thay nguoi dung' : error.message,
      error.code === 'P2025' ? 404 : getStatusCode(error)
    )
  }
}

async function unlinkBankhubAccountLocal(req, res) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        bankhubAccountXid: null,
        bankAccountNumber: null,
        bankName: null,
        bankAccountName: null,
        sepayLinkedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đã hủy liên kết BankHub trong FinTrack. Tài khoản trên SePay Sandbox không bị hủy.',
      data: updatedUser,
    })
  } catch (error) {
    console.error('unlinkBankhubAccountLocal error:', error.message)
    return sendError(
      res,
      error.code === 'P2025' ? 'Khong tim thay nguoi dung' : error.message,
      error.code === 'P2025' ? 404 : getStatusCode(error)
    )
  }
}

async function createBankHubSandboxTransaction(req, res) {
  const parsed = bankHubSandboxTransactionSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Du lieu giao dich sandbox khong hop le',
      400
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
      },
    })

    if (!user) {
      return sendError(res, 'Khong tim thay nguoi dung', 404)
    }

    if (!user.bankhubAccountXid) {
      return sendError(res, 'User chưa liên kết BankHub Sandbox', 400)
    }

    const bankHubResponse = await bankHubService.createMockTransaction({
      bankAccountXid: user.bankhubAccountXid,
      transferType: parsed.data.transferType,
      amount: parsed.data.amount,
      content: parsed.data.content,
    })

    return res.status(200).json({
      success: true,
      message: 'Đã gửi yêu cầu tạo giao dịch sandbox tới SePay. Đang chờ webhook.',
      data: bankHubResponse,
    })
  } catch (err) {
    console.error('createBankHubSandboxTransaction error:', err.message)
    return sendError(
      res,
      err.message || 'Loi khi tao giao dich sandbox BankHub',
      getStatusCode(err)
    )
  }
}

module.exports = {
  getSepayLogs,
  getLinkedUsers,
  getPlatformStatistics,
  getNotifications,
  getFeedback,
  updateFeedbackStatus,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
  assignBankhubAccount,
  unlinkBankhubAccountLocal,
  createBankHubSandboxTransaction,
}
