const prisma = require('../lib/prisma')
const {
  register: registerService,
  login: loginService,
  refresh: refreshService,
  logout: logoutService,
} = require('../services/auth.service')

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  })
}

// Xử lý đăng ký tài khoản local mới bằng name, email, password.
async function registerController(req, res) {
  const { name, email, password } = req.body || {}

  if (!name) {
    return sendError(res, 400, 'Vui lòng nhập họ tên')
  }

  if (!email) {
    return sendError(res, 400, 'Vui lòng nhập email')
  }

  if (!password) {
    return sendError(res, 400, 'Vui lòng nhập mật khẩu')
  }

  if (password.length < 8) {
    return sendError(res, 400, 'Mật khẩu phải có ít nhất 8 ký tự')
  }

  try {
    const result = await registerService(name, email, password)
    return res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return sendError(res, 400, error.message)
  }
}

// Xử lý đăng nhập bằng email và mật khẩu local.
async function loginController(req, res) {
  const { email, password } = req.body || {}

  if (!email) {
    return sendError(res, 400, 'Vui lòng nhập email')
  }

  if (!password) {
    return sendError(res, 400, 'Vui lòng nhập mật khẩu')
  }

  try {
    const result = await loginService(email, password)
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return sendError(res, 401, error.message)
  }
}

// Xử lý cấp lại token từ refresh token hợp lệ.
async function refreshTokenController(req, res) {
  const { refreshToken } = req.body || {}

  if (!refreshToken) {
    return sendError(res, 400, 'Vui lòng cung cấp refresh token')
  }

  try {
    const result = await refreshService(refreshToken)
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return sendError(res, 401, error.message)
  }
}

// Xử lý đăng xuất bằng cách xoá refresh token đang lưu trong User.
async function logoutUserController(req, res) {
  const userId = req.user.userId

  try {
    await logoutService(userId)
    return res.status(200).json({
      success: true,
      data: { message: 'Đăng xuất thành công' },
    })
  } catch (error) {
    return sendError(res, 500, error.message)
  }
}

// Lấy thông tin an toàn của user hiện tại.
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
        avatarUrl: true,
        balance: true,
        provider: true,
        createdAt: true,
      },
    })

    if (!user) {
      return sendError(res, 404, 'Không tìm thấy người dùng')
    }

    return res.status(200).json({
      success: true,
      data: user,
    })
  } catch (error) {
    return sendError(res, 500, error.message)
  }
}

module.exports = {
  registerController,
  loginController,
  refreshTokenController,
  logoutUserController,
  getMeController,
}
