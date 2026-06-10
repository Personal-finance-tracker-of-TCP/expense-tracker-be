const prisma = require('../lib/prisma')
const { z } = require('zod')
const adminService = require('../services/admin.service')
const bankHubService = require('../services/bankhub.service')
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

function getStatusCode(error) {
  return error.statusCode || 500
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
    return sendError(res, err.message || 'Lỗi khi giả lập SePay', getStatusCode(err))
  }
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
      where: {
        bankAccountNumber: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
        role: true,
      },
      orderBy: {
        sepayLinkedAt: 'desc',
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
        bankAccountNumber: true,
      },
    })

    if (!user) {
      return sendError(res, 'Khong tim thay nguoi dung', 404)
    }

    if (!user.bankAccountNumber) {
      return sendError(res, 'User chưa liên kết BankHub Sandbox', 400)
    }

    const bankHubResponse = await bankHubService.createMockTransaction({
      bankAccountXid: user.bankAccountNumber,
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
  simulateSepay,
  getSepayLogs,
  getLinkedUsers,
  getPlatformStatistics,
  createNotification,
  createBankHubSandboxTransaction,
}
