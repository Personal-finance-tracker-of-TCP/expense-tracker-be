const prisma = require('../lib/prisma')
const { comparePassword, hashPassword } = require('../utils/password')

const EMAIL_VERIFICATION_TTL_MINUTES = 10
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function createEmailVerificationToken(email) {
  const normalizedEmail = normalizeEmail(email)
  const otp = generateOtp()
  const otpHash = await hashPassword(otp)
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000
  )

  await prisma.emailVerificationToken.deleteMany({
    where: { email: normalizedEmail },
  })

  await prisma.emailVerificationToken.create({
    data: {
      email: normalizedEmail,
      otpHash,
      expiresAt,
    },
  })

  return { otp, expiresAt }
}

async function findActiveEmailVerificationToken(email) {
  return prisma.emailVerificationToken.findFirst({
    where: {
      email: normalizeEmail(email),
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

async function consumeEmailVerificationToken({ email, otp }) {
  const normalizedEmail = normalizeEmail(email)
  const token = await findActiveEmailVerificationToken(normalizedEmail)

  if (!token) {
    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  const matched = await comparePassword(otp, token.otpHash)

  if (!matched) {
    const nextAttemptCount = token.attemptCount + 1

    await prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: {
        attemptCount: nextAttemptCount,
        usedAt:
          nextAttemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS
            ? new Date()
            : null,
      },
    })

    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn')
  }

  await prisma.emailVerificationToken.update({
    where: { id: token.id },
    data: {
      usedAt: new Date(),
      attemptCount: token.attemptCount + 1,
    },
  })

  return { email: normalizedEmail }
}

async function clearEmailVerificationTokens(email) {
  await prisma.emailVerificationToken.deleteMany({
    where: { email: normalizeEmail(email) },
  })
}

module.exports = {
  EMAIL_VERIFICATION_TTL_MINUTES,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  clearEmailVerificationTokens,
}
