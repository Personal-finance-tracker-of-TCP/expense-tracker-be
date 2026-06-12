const prisma = require('../lib/prisma')
const { comparePassword, hashPassword } = require('../utils/password')

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      provider: true,
    },
  })

  if (!user) {
    throw new Error('Không tìm thấy người dùng')
  }

  if (!user.passwordHash) {
    throw new Error('Tài khoản này không hỗ trợ đổi mật khẩu')
  }

  const isMatched = await comparePassword(currentPassword, user.passwordHash)

  if (!isMatched) {
    throw new Error('Mật khẩu hiện tại không đúng')
  }

  const newPasswordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      refreshToken: null,
    },
  })

  return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' }
}

module.exports = {
  changePassword,
}