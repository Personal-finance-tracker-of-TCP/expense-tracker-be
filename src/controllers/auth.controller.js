const prisma = require('../lib/prisma')
const {
  register: registerService,
  login: loginService,
  refresh: refreshService,
  logout: logoutService,
} = require('../services/auth.service')
const { sendSuccess, sendError } = require('../utils/response')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Xu ly dang ky tai khoan local bang name, email, password.
async function registerController(req, res) {
  const name = normalizeText(req.body?.name || req.body?.fullName)
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!name) {
    return sendError(res, 'Vui lòng nhập họ tên')
  }

  if (name.length < 2) {
    return sendError(res, 'Tên phải có ít nhất 2 ký tự')
  }

  if (!email) {
    return sendError(res, 'Vui lòng nhập email')
  }

  if (!isValidEmail(email)) {
    return sendError(res, 'Email không hợp lệ')
  }

  if (!password) {
    return sendError(res, 'Vui lòng nhập mật khẩu')
  }

  if (password.length < 8) {
    return sendError(res, 'Mật khẩu phải có ít nhất 8 ký tự')
  }

  try {
    const result = await registerService(name, email, password)
    return sendSuccess(res, result, 201)
  } catch (error) {
    return sendError(res, error.message)
  }
}

// Xu ly dang nhap bang email va mat khau local.
async function loginController(req, res) {
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email) {
    return sendError(res, 'Vui lòng nhập email')
  }

  if (!isValidEmail(email)) {
    return sendError(res, 'Email không hợp lệ')
  }

  if (!password) {
    return sendError(res, 'Vui lòng nhập mật khẩu')
  }

  try {
    const result = await loginService(email, password)
    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message, 401)
  }
}

// Cap lai access token tu refresh token hop le.
async function refreshTokenController(req, res) {
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : ''

  if (!refreshToken) {
    return sendError(res, 'Vui lòng cung cấp refresh token')
  }

  try {
    const result = await refreshService(refreshToken)
    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message, 401)
  }
}

// Dang xuat bang cach xoa refresh token dang luu trong User.
async function logoutUserController(req, res) {
  const userId = req.user.userId

  try {
    await logoutService(userId)
    return sendSuccess(res, { message: 'Đăng xuất thành công' })
  } catch (error) {
    return sendError(res, error.message, 500)
  }
}

// Lay thong tin an toan cua user hien tai.
async function getMeController(req, res) {
  const userId = req.user.userId

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
        avatarUrl: true,
        balance: true,
        provider: true,
        createdAt: true,
      },
    })

    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng', 404)
    }

    return sendSuccess(res, user)
  } catch (error) {
    return sendError(res, error.message, 500)
  }
}

module.exports = {
  registerController,
  loginController,
  refreshTokenController,
  logoutUserController,
  getMeController,
}
