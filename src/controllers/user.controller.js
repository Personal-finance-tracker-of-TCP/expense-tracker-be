const { z } = require('zod')
const prisma = require('../lib/prisma')
const { sendSuccess, sendError } = require('../utils/response')

const updateBalanceSchema = z.object({
  balance: z.coerce
    .number({ message: 'So du phai la so' })
    .min(0, 'So du phai lon hon hoac bang 0'),
})

function generateSandboxAccountNumber() {
  let suffix = ''
  for (let index = 0; index < 8; index += 1) {
    suffix += Math.floor(Math.random() * 10).toString()
  }
  return `9704${suffix}`
}

function generateSepayCodeCandidate() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let index = 0; index < 6; index += 1) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `MTK${suffix}`
}

function normalizeSandboxAccountNumber(value) {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw Object.assign(new Error('bankAccountNumber phai la chuoi'), { statusCode: 400 })
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw Object.assign(new Error('bankAccountNumber khong duoc de trong'), {
      statusCode: 400,
    })
  }

  if (trimmed.length > 64) {
    throw Object.assign(new Error('bankAccountNumber toi da 64 ky tu'), {
      statusCode: 400,
    })
  }

  return trimmed
}

async function ensureAccountNumberAvailable(bankAccountNumber, userId) {
  const conflict = await prisma.user.findFirst({
    where: {
      bankAccountNumber,
      NOT: { id: userId },
    },
    select: { id: true },
  })

  if (conflict) {
    throw Object.assign(new Error('Tai khoan sandbox da duoc lien ket'), {
      statusCode: 409,
    })
  }
}

async function generateUniqueSandboxAccountNumber(userId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bankAccountNumber = generateSandboxAccountNumber()
    const conflict = await prisma.user.findFirst({
      where: {
        bankAccountNumber,
        NOT: { id: userId },
      },
      select: { id: true },
    })

    if (!conflict) return bankAccountNumber
  }

  throw Object.assign(new Error('Khong the tao tai khoan sandbox duy nhat'), {
    statusCode: 500,
  })
}

async function generateUniqueSepayCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sepayCode = generateSepayCodeCandidate()
    const conflict = await prisma.user.findUnique({
      where: { sepayCode },
      select: { id: true },
    })

    if (!conflict) return sepayCode
  }

  throw Object.assign(new Error('Khong the tao ma SePay duy nhat'), {
    statusCode: 500,
  })
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    balance: user.balance,
    sepayCode: user.sepayCode,
    bankhubAccountXid: user.bankhubAccountXid,
    bankAccountNumber: user.bankAccountNumber,
    bankName: user.bankName,
    bankAccountName: user.bankAccountName,
    sepayLinkedAt: user.sepayLinkedAt,
    avatarUrl: user.avatarUrl,
  }
}

async function updateMyBalance(req, res) {
  const parsed = updateBalanceSchema.safeParse(req.body)
  if (!parsed.success) {
    return sendError(
      res,
      parsed.error.issues?.[0]?.message || 'Du lieu so du khong hop le',
      400
    )
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { balance: parsed.data.balance },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance: true,
        sepayCode: true,
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
        avatarUrl: true,
      },
    })

    return sendSuccess(res, {
      user: toSafeUser(user),
      balance: user.balance,
    })
  } catch (error) {
    console.error('updateMyBalance error:', error)
    return sendError(res, 'Loi khi cap nhat so du', 500)
  }
}

async function updateMySepaySandboxLink(req, res) {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        sepayCode: true,
      },
    })

    if (!currentUser) {
      return sendError(res, 'Khong tim thay nguoi dung', 404)
    }

    const providedAccountNumber = normalizeSandboxAccountNumber(
      req.body?.bankAccountNumber
    )
    const bankAccountNumber =
      providedAccountNumber || (await generateUniqueSandboxAccountNumber(currentUser.id))

    await ensureAccountNumberAvailable(bankAccountNumber, currentUser.id)

    const sepayCode = currentUser.sepayCode || (await generateUniqueSepayCode())
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        sepayCode,
        bankAccountNumber,
        sepayLinkedAt: new Date(),
      },
      select: {
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
      },
    })

    return sendSuccess(res, {
      sepayCode: updatedUser.sepayCode,
      bankAccountNumber: updatedUser.bankAccountNumber,
      sepayLinkedAt: updatedUser.sepayLinkedAt,
      isLinked: true,
    })
  } catch (error) {
    console.error('updateMySepaySandboxLink error:', error.message)
    return sendError(
      res,
      error.message || 'Loi khi cap nhat lien ket SePay Sandbox',
      error.statusCode || 500
    )
  }
}

module.exports = {
  updateMyBalance,
  updateMySepaySandboxLink,
}
