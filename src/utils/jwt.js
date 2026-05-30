const jwt = require('jsonwebtoken')

// Tạo access token ngắn hạn để xác thực các request API.
function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  })
}

// Tạo refresh token dài hạn để cấp lại access token khi cần.
function generateRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  })
}

// Xác thực access token và trả về payload đã giải mã.
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET)
}

// Xác thực refresh token và trả về payload đã giải mã.
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
}
