const { verifyAccessToken } = require('../utils/jwt')

function getCookieByName(cookieHeader, name) {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';')
  for (const cookieValue of cookies) {
    const cookie = cookieValue.trim()
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.substring(name.length + 1))
    }
  }

  return null
}

function getBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  return authHeader.split(' ')[1] || null
}

function attachVerifiedUser(req, token) {
  const payload = verifyAccessToken(token)
  req.user = {
    userId: payload.userId,
    role: payload.role,
  }
}

function authMiddleware(req, res, next) {
  const bearerToken = getBearerToken(req.headers.authorization)
  const cookieToken =
    req.cookies?.access_token ||
    getCookieByName(req.headers.cookie, 'access_token')

  if (!bearerToken && !cookieToken) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực. Vui lòng đăng nhập',
    })
  }

  if (bearerToken) {
    try {
      attachVerifiedUser(req, bearerToken)
      return next()
    } catch {
      // If a cookie token exists, try it below before rejecting the request.
    }
  }

  if (cookieToken) {
    try {
      attachVerifiedUser(req, cookieToken)
      return next()
    } catch {
      // Return the generic invalid token response below.
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Token không hợp lệ hoặc đã hết hạn',
  })
}

module.exports = authMiddleware
