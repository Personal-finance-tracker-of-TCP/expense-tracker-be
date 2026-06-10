const prisma = require('../lib/prisma')
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt')
const { hashPassword, comparePassword } = require('../utils/password')

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sepayCode: user.sepayCode,
    bankAccountNumber: user.bankAccountNumber,
    sepayLinkedAt: user.sepayLinkedAt,
    avatarUrl: user.avatarUrl,
    balance: user.balance,
  }
}

// Đăng ký tài khoản local mới và cấp access token, refresh token.
async function generateSepayCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`
    const sepayCode = `MTU${suffix}`
    const existing = await prisma.user.findUnique({ where: { sepayCode } })
    if (!existing) return sepayCode
  }

  throw new Error('Khong the tao ma SePay, vui long thu lai')
}

async function register(name, email, password) {
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existing) {
    throw new Error('Email đã được sử dụng')
  }

  const hashed = await hashPassword(password)
  const sepayCode = await generateSepayCode()

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashed,
      sepayCode,
      provider: 'local',
    },
  })

  const accessToken = generateAccessToken(user.id)
  const refreshToken = generateRefreshToken(user.id)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  })

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
  }
}

// Đăng nhập bằng email, mật khẩu local và cấp cặp token mới.
async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) {
    throw new Error('Email hoặc mật khẩu không đúng')
  }

  if (!user.passwordHash) {
    throw new Error('Tài khoản này đăng nhập bằng Google')
  }

  const isPasswordMatched = await comparePassword(password, user.passwordHash)

  if (!isPasswordMatched) {
    throw new Error('Email hoặc mật khẩu không đúng')
  }

  const accessToken = generateAccessToken(user.id)
  const refreshToken = generateRefreshToken(user.id)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  })

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
  }
}

// Làm mới access token bằng refresh token hợp lệ và xoay vòng refresh token.
async function refresh(token) {
  const payload = verifyRefreshToken(token)

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })

  if (!user) {
    throw new Error('User không tồn tại')
  }

  if (user.refreshToken !== token) {
    throw new Error('Refresh token không hợp lệ')
  }

  const newAccessToken = generateAccessToken(user.id)
  const newRefreshToken = generateRefreshToken(user.id)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  })

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  }
}

// Đăng xuất bằng cách xoá refresh token đang lưu trong User.
async function logout(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  })
}

module.exports = {
  register,
  login,
  refresh,
  logout,
}
