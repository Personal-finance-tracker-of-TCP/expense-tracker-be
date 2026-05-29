const { verifyAccessToken } = require('../utils/jwt')

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực. Vui lòng đăng nhập',
    })
  }

  const token = authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token không được để trống',
    })
  }

  try {
    const payload = verifyAccessToken(token)
    req.user = { userId: payload.userId }
    return next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn',
    })
  }
}

module.exports = authMiddleware
