const bcrypt = require('bcryptjs')

// Hash mật khẩu plain text trước khi lưu vào field passwordHash của User.
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 12)
}

// So sánh mật khẩu plain text với giá trị passwordHash lấy từ User.
async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword)
}

module.exports = {
  hashPassword,
  comparePassword,
}
