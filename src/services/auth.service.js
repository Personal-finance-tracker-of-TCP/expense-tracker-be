const prisma = require('../lib/prisma')
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt')
const { hashPassword, comparePassword } = require('../utils/password')
const {
  clearPasswordResetTokens,
  createPasswordResetToken,
  verifyPasswordResetToken,
  updatePasswordWithResetToken,
} = require('./password-reset.service')
const {
  clearEmailVerificationTokens,
  consumeEmailVerificationToken,
  createEmailVerificationToken,
} = require('./email-verification.service')
const {
  sendPasswordResetOtpEmail,
  sendRegistrationOtpEmail,
} = require('./email.service')

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sepayCode: user.sepayCode,
    bankhubAccountXid: user.bankhubAccountXid,
    bankAccountNumber: user.bankAccountNumber,
    bankName: user.bankName,
    bankAccountName: user.bankAccountName,
    sepayLinkedAt: user.sepayLinkedAt,
    avatarUrl: user.avatarUrl,
    balance: user.balance,
    provider: user.provider,
    createdAt: user.createdAt,
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

async function requestRegistrationOtp(name, email) {
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      passwordHash: true,
    },
  })

  if (existing?.passwordHash) {
    throw new Error('Email đã được sử dụng')
  }

  const { otp, expiresAt } = await createEmailVerificationToken(normalizedEmail)
  let emailResult

  try {
    emailResult = await sendRegistrationOtpEmail({
      to: normalizedEmail,
      name,
      otp,
    })
  } catch (error) {
    await clearEmailVerificationTokens(normalizedEmail)
    throw error
  }

  return {
    message: 'Mã OTP xác thực đăng ký đã được gửi đến email của bạn.',
    expiresAt,
    delivered: emailResult.delivered,
  }
}

async function register(name, email, password, otp) {
  const normalizedEmail = email.trim().toLowerCase()

  await consumeEmailVerificationToken({ email: normalizedEmail, otp })

  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (user?.passwordHash) {
    throw new Error('Email đã được sử dụng')
  }

  const hashed = await hashPassword(password)

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim() || user.name,
        passwordHash: hashed,
        provider: user.provider || 'local',
      },
    })
  } else {
    const sepayCode = await generateSepayCode()

    user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashed,
        sepayCode,
        provider: 'local',
      },
    })
  }

  const accessToken = generateAccessToken(user.id, user.role)
  const refreshToken = generateRefreshToken(user.id)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  })

  await clearEmailVerificationTokens(normalizedEmail)

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

  const accessToken = generateAccessToken(user.id, user.role)
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

// Đăng nhập/đăng ký bằng hồ sơ Google đã được NextAuth xác thực ở frontend server.
async function loginWithGoogle({ email, name, avatarUrl }) {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim()

  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: normalizedName || user.name,
        avatarUrl: avatarUrl || user.avatarUrl,
        provider: user.provider || 'google',
      },
    })
  } else {
    const sepayCode = await generateSepayCode()
    user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash: null,
        sepayCode,
        provider: 'google',
        avatarUrl: avatarUrl || null,
      },
    })
  }

  const accessToken = generateAccessToken(user.id, user.role)
  const refreshToken = generateRefreshToken(user.id)

  user = await prisma.user.update({
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

  const newAccessToken = generateAccessToken(user.id, user.role)
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

async function requestPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) {
    return {
      message:
        'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã OTP đặt lại mật khẩu.',
    }
  }

  const { otp, expiresAt } = await createPasswordResetToken(user)
  let emailResult

  try {
    emailResult = await sendPasswordResetOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    })
  } catch (error) {
    await clearPasswordResetTokens(user.id)
    throw error
  }

  return {
    message:
      'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã OTP đặt lại mật khẩu.',
    expiresAt,
    delivered: emailResult.delivered,
  }
}

async function verifyPasswordResetOtp(email, otp) {
  await verifyPasswordResetToken({ email, otp })

  return {
    message: 'Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.',
  }
}

async function resetPassword(email, otp, newPassword) {
  await updatePasswordWithResetToken({ email, otp, newPassword })

  return {
    message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
  }
}

module.exports = {
  requestRegistrationOtp,
  register,
  login,
  loginWithGoogle,
  refresh,
  logout,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
}
