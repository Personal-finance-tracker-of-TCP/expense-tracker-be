const prisma = require('../lib/prisma')
const {
  requestRegistrationOtp: requestRegistrationOtpService,
  register: registerService,
  login: loginService,
  loginWithGoogle,
  refresh: refreshService,
  logout: logoutService,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
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

function isValidOtp(value) {
  return /^\d{6}$/.test(value)
}

// Xu ly dang ky tai khoan local bang name, email, password.
async function requestRegisterOtpController(req, res) {
  const name = normalizeText(req.body?.name || req.body?.fullName)
  const email = normalizeEmail(req.body?.email)

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

  try {
    const result = await requestRegistrationOtpService(name, email)
    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message)
  }
}

async function registerController(req, res) {
  const name = normalizeText(req.body?.name || req.body?.fullName)
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : ''

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

  if (!otp) {
    return sendError(res, 'Vui lòng nhập mã OTP xác thực email')
  }

  if (!isValidOtp(otp)) {
    return sendError(res, 'Mã OTP phải gồm 6 chữ số')
  }

  try {
    const result = await registerService(name, email, password, otp)
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

// NextAuth Google callback gọi endpoint này sau khi Google đã xác thực người dùng.
async function googleLoginController(req, res) {
  const expectedSecret = process.env.OAUTH_EXCHANGE_SECRET
  if (
    expectedSecret &&
    req.headers['x-oauth-exchange-secret'] !== expectedSecret
  ) {
    return sendError(res, 'Không được phép trao đổi OAuth', 401)
  }

  const email = normalizeEmail(req.body?.email)
  const name = normalizeText(req.body?.name || req.body?.fullName)
  const avatarUrl = normalizeText(req.body?.avatarUrl)

  if (!email) {
    return sendError(res, 'Google không trả về email')
  }

  if (!isValidEmail(email)) {
    return sendError(res, 'Email Google không hợp lệ')
  }

  if (!name) {
    return sendError(res, 'Google không trả về họ tên')
  }

  try {
    const result = await loginWithGoogle({ email, name, avatarUrl })
    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message, 500)
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
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
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

async function forgotPasswordController(req, res) {
  const email = normalizeEmail(req.body?.email)

  if (!email) {
    return sendError(res, 'Vui lòng nhập email')
  }

  if (!isValidEmail(email)) {
    return sendError(res, 'Email không hợp lệ')
  }

  try {
    const result = await requestPasswordReset(email)
    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message, 500)
  }
}

async function verifyResetOtpController(req, res) {
  const email = normalizeEmail(req.body?.email)
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : ''

  if (!email) {
    return sendError(res, 'Vui lòng nhập email')
  }

  if (!isValidEmail(email)) {
    return sendError(res, 'Email không hợp lệ')
  }

  if (!otp) {
    return sendError(res, 'Vui lòng nhập mã OTP')
  }

  if (!isValidOtp(otp)) {
    return sendError(res, 'Mã OTP phải gồm 6 chữ số')
  }

  try {
    const result = await verifyPasswordResetOtp(email, otp)
    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message, 400)
  }
}

async function resetPasswordController(req, res) {
  const email = normalizeEmail(req.body?.email)
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
  const confirmNewPassword = typeof req.body?.confirmNewPassword === 'string' ? req.body.confirmNewPassword : ''

  if (!email) {
    return sendError(res, 'Vui lòng nhập email')
  }

  if (!isValidEmail(email)) {
    return sendError(res, 'Email không hợp lệ')
  }

  if (!otp) {
    return sendError(res, 'Vui lòng nhập mã OTP')
  }

  if (!isValidOtp(otp)) {
    return sendError(res, 'Mã OTP phải gồm 6 chữ số')
  }

  if (!newPassword) {
    return sendError(res, 'Vui lòng nhập mật khẩu mới')
  }

  if (newPassword.length < 8) {
    return sendError(res, 'Mật khẩu mới phải có ít nhất 8 ký tự')
  }

  if (newPassword !== confirmNewPassword) {
    return sendError(res, 'Mật khẩu xác nhận không khớp')
  }

  try {
    const result = await resetPassword(email, otp, newPassword)
    return sendSuccess(res, result)
  } catch (error) {
    return sendError(res, error.message, 400)
  }
}

module.exports = {
  requestRegisterOtpController,
  registerController,
  loginController,
  googleLoginController,
  refreshTokenController,
  logoutUserController,
  getMeController,
  forgotPasswordController,
  verifyResetOtpController,
  resetPasswordController,
}
