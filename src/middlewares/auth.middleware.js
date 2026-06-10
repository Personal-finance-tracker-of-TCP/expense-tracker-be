const { verifyAccessToken } = require('../utils/jwt')

// Helper function to parse cookie string manually if cookie-parser didn't catch it
function getCookieByName(cookieHeader, name) {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';')
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim()
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1))
    }
  }
  return null
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const cookieHeader = req.headers.cookie

  const hasAuthHeader = !!authHeader
  const bearerToken = hasAuthHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  // Extract from req.cookies (cookie-parser) or manually from headers
  const cookieToken = req.cookies?.access_token || getCookieByName(cookieHeader, 'access_token')
  const hasCookieToken = !!cookieToken

  console.log(`[AuthMiddleware Debug] auth header exists: ${hasAuthHeader}, cookie token exists: ${hasCookieToken}`)
  console.log(`[AuthMiddleware Debug] jwt secret env exists: ${!!process.env.JWT_ACCESS_SECRET}`)

  if (!bearerToken && !cookieToken) {
    console.log('[AuthMiddleware Debug] No token provided in authorization header or cookies')
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực. Vui lòng đăng nhập',
    })
  }

  // 1. Try Bearer token first
  if (bearerToken) {
    try {
      console.log('[AuthMiddleware Debug] Attempting to verify token from Authorization header')
      const payload = verifyAccessToken(bearerToken)
      req.user = { userId: payload.userId }
      console.log(`[AuthMiddleware Debug] Verification successful via bearer. userId: ${payload.userId}`)
      return next()
    } catch (error) {
      console.log(`[AuthMiddleware Debug] Bearer token verification failed. Name: ${error.name}, Message: ${error.message}`)
    }
  }

  // 2. Fallback to Cookie token
  if (cookieToken) {
    try {
      console.log('[AuthMiddleware Debug] Attempting fallback to verify token from access_token cookie')
      const payload = verifyAccessToken(cookieToken)
      req.user = { userId: payload.userId }
      console.log(`[AuthMiddleware Debug] Verification successful via cookie. userId: ${payload.userId}`)
      return next()
    } catch (error) {
      console.log(`[AuthMiddleware Debug] Cookie token verification failed. Name: ${error.name}, Message: ${error.message}`)
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Token không hợp lệ hoặc đã hết hạn',
  })
}

module.exports = authMiddleware

