const { z } = require('zod')
const prisma = require('../lib/prisma')
const { sendSuccess, sendError } = require('../utils/response')
const { changePassword } = require('../services/user.service')

const updateBalanceSchema = z.object({
  balance: z.coerce
    .number({ message: 'So du phai la so' })
    .min(0, 'So du phai lon hon hoac bang 0'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự'),
  confirmNewPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmNewPassword'],
})

const MAX_AVATAR_URL_LENGTH = 1_500_000

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự').max(80, 'Tên tối đa 80 ký tự'),
  avatarUrl: z
    .string()
    .trim()
    .max(MAX_AVATAR_URL_LENGTH, 'Ảnh đại diện tối đa 1MB')
    .optional()
    .or(z.literal('')),
})

function generateSandboxAccountNumber() {
  let suffix = ''
  for (let index = 0; index < 8; index += 1) {
    suffix += Math.floor(Math.random() * 10).toString()
  }
  return `9704${suffix}`
}

function generateSepayCodeCandidate() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let index = 0; index < 6; index += 1) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `MTK${suffix}`
}

function normalizeSandboxAccountNumber(value) {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw Object.assign(new Error('bankAccountNumber phai la chuoi'), { statusCode: 400 })
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw Object.assign(new Error('bankAccountNumber khong duoc de trong'), {
      statusCode: 400,
    })
  }

  if (trimmed.length > 64) {
    throw Object.assign(new Error('bankAccountNumber toi da 64 ky tu'), {
      statusCode: 400,
    })
  }

  return trimmed
}

async function ensureAccountNumberAvailable(bankAccountNumber, userId) {
  const conflict = await prisma.user.findFirst({
    where: {
      bankAccountNumber,
      NOT: { id: userId },
    },
    select: { id: true },
  })

  if (conflict) {
    throw Object.assign(new Error('Tai khoan sandbox da duoc lien ket'), {
      statusCode: 409,
    })
  }
}

async function generateUniqueSandboxAccountNumber(userId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bankAccountNumber = generateSandboxAccountNumber()
    const conflict = await prisma.user.findFirst({
      where: {
        bankAccountNumber,
        NOT: { id: userId },
      },
      select: { id: true },
    })

    if (!conflict) return bankAccountNumber
  }

  throw Object.assign(new Error('Khong the tao tai khoan sandbox duy nhat'), {
    statusCode: 500,
  })
}

async function generateUniqueSepayCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sepayCode = generateSepayCodeCandidate()
    const conflict = await prisma.user.findUnique({
      where: { sepayCode },
      select: { id: true },
    })

    if (!conflict) return sepayCode
  }

  throw Object.assign(new Error('Khong the tao ma SePay duy nhat'), {
    statusCode: 500,
  })
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    balance: user.balance,
    sepayCode: user.sepayCode,
    bankhubAccountXid: user.bankhubAccountXid,
    bankAccountNumber: user.bankAccountNumber,
    bankName: user.bankName,
    bankAccountName: user.bankAccountName,
    sepayLinkedAt: user.sepayLinkedAt,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    createdAt: user.createdAt,
  }
}

async function updateMyBalance(req, res) {
  const parsed = updateBalanceSchema.safeParse(req.body)
  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Du lieu so du khong hop le',
      400
    )
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { balance: parsed.data.balance },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance: true,
        sepayCode: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
        avatarUrl: true,
      },
    })

    return sendSuccess(res, {
      user: toSafeUser(user),
      balance: user.balance,
    })
  } catch (error) {
    console.error('updateMyBalance error:', error)
    return sendError(res, 'Loi khi cap nhat so du', 500)
  }
}

async function getMyProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance: true,
        sepayCode: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
        avatarUrl: true,
        provider: true,
        createdAt: true,
      },
    })

    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng', 404)
    }

    return sendSuccess(res, toSafeUser(user))
  } catch (error) {
    console.error('getMyProfile error:', error)
    return sendError(res, 'Lỗi khi lấy hồ sơ', 500)
  }
}

async function updateMyProfile(req, res) {
  const parsed = updateProfileSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Dữ liệu hồ sơ không hợp lệ',
      400
    )
  }

  const avatarUrl = parsed.data.avatarUrl ? parsed.data.avatarUrl : null

  try {
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        name: parsed.data.name,
        avatarUrl,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance: true,
        sepayCode: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
        avatarUrl: true,
        provider: true,
        createdAt: true,
      },
    })

    return sendSuccess(res, { user: toSafeUser(user) })
  } catch (error) {
    console.error('updateMyProfile error:', error)
    return sendError(res, 'Lỗi khi cập nhật hồ sơ', 500)
  }
}

async function updateMySepaySandboxLink(req, res) {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        sepayCode: true,
      },
    })

    if (!currentUser) {
      return sendError(res, 'Khong tim thay nguoi dung', 404)
    }

    const providedAccountNumber = normalizeSandboxAccountNumber(
      req.body?.bankAccountNumber
    )
    const bankAccountNumber =
      providedAccountNumber || (await generateUniqueSandboxAccountNumber(currentUser.id))

    await ensureAccountNumberAvailable(bankAccountNumber, currentUser.id)

    const sepayCode = currentUser.sepayCode || (await generateUniqueSepayCode())
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        sepayCode,
        bankAccountNumber,
        sepayLinkedAt: new Date(),
      },
      select: {
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
      },
    })

    return sendSuccess(res, {
      sepayCode: updatedUser.sepayCode,
      bankAccountNumber: updatedUser.bankAccountNumber,
      sepayLinkedAt: updatedUser.sepayLinkedAt,
      isLinked: true,
    })
  } catch (error) {
    console.error('updateMySepaySandboxLink error:', error.message)
    return sendError(
      res,
      error.message || 'Loi khi cap nhat lien ket SePay Sandbox',
      error.statusCode || 500
    )
  }
}

async function changeMyPassword(req, res) {
  const parsed = changePasswordSchema.safeParse(req.body)

  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Du lieu doi mat khau khong hop le',
      400
    )
  }

  try {
    const result = await changePassword(
      req.user.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword
    )

    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message, 400)
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateMyBalance,
  updateMySepaySandboxLink,
  changeMyPassword,
}
