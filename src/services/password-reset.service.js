const prisma = require('../lib/prisma')
const { comparePassword, hashPassword } = require('../utils/password')

const RESET_TOKEN_TTL_MINUTES = 10
const RESET_TOKEN_MAX_ATTEMPTS = 5

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function createPasswordResetToken(user) {
  const otp = generateOtp()
  const otpHash = await hashPassword(otp)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  })

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      otpHash,
      expiresAt,
    },
  })

  return { otp, expiresAt }
}

async function clearPasswordResetTokens(userId) {
  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  })
}

async function findActivePasswordResetToken(userId) {
  return prisma.passwordResetToken.findFirst({
    where: {
      userId,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

async function consumePasswordResetToken({ email, otp }) {
  const normalizedEmail = normalizeEmail(email)

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) {
    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  const token = await findActivePasswordResetToken(user.id)

  if (!token) {
    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  const matched = await comparePassword(otp, token.otpHash)

  if (!matched) {
    const nextAttemptCount = token.attemptCount + 1

    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: {
        attemptCount: nextAttemptCount,
        usedAt: nextAttemptCount >= RESET_TOKEN_MAX_ATTEMPTS ? new Date() : null,
      },
    })

    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  await prisma.passwordResetToken.update({
    where: { id: token.id },
    data: {
      usedAt: new Date(),
      attemptCount: token.attemptCount + 1,
    },
  })

  return { user }
}

async function verifyPasswordResetToken({ email, otp }) {
  const normalizedEmail = normalizeEmail(email)

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) {
    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  const token = await findActivePasswordResetToken(user.id)

  if (!token) {
    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  const matched = await comparePassword(otp, token.otpHash)

  if (!matched) {
    const nextAttemptCount = token.attemptCount + 1

    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: {
        attemptCount: nextAttemptCount,
        usedAt: nextAttemptCount >= RESET_TOKEN_MAX_ATTEMPTS ? new Date() : null,
      },
    })

    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  return { user }
}

async function updatePasswordWithResetToken({ email, otp, newPassword }) {
  const { user } = await consumePasswordResetToken({ email, otp })
  const newPasswordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      refreshToken: null,
    },
  })

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  })

  return user
}

module.exports = {
  RESET_TOKEN_TTL_MINUTES,
  clearPasswordResetTokens,
  createPasswordResetToken,
  verifyPasswordResetToken,
  updatePasswordWithResetToken,
}
