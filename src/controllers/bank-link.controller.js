const prisma = require('../lib/prisma')
const { sendSuccess, sendError } = require('../utils/response')

function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `MTK${result}`
}

function getSystemBank() {
  return {
    name: process.env.SYSTEM_BANK_NAME || 'MBBank',
    accountNumber: process.env.SYSTEM_BANK_ACCOUNT || '970400000000',
    accountHolder: process.env.SYSTEM_BANK_HOLDER || 'CONG TY CONG NGHE FinTrack',
  }
}

async function generateUniqueSepayCode() {
  for (let attempts = 0; attempts < 10; attempts++) {
    const potentialCode = generateRandomCode()
    const conflict = await prisma.user.findUnique({
      where: { sepayCode: potentialCode },
      select: { id: true },
    })

    if (!conflict) return potentialCode
  }

  throw new Error('Unable to generate unique sepayCode')
}

function toBankLinkResponse(user, extra = {}) {
  return {
    sepayCode: user.sepayCode,
    bankAccountNumber: user.bankAccountNumber,
    sepayLinkedAt: user.sepayLinkedAt,
    isLinked: Boolean(user.bankAccountNumber),
    systemBank: getSystemBank(),
    ...extra,
  }
}

async function linkBank(req, res) {
  const userId = req.user.userId

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
      },
    })

    if (!user) {
      return sendError(res, 'Khong tim thay nguoi dung', 404)
    }

    if (user.sepayCode) {
      const currentUser = user.sepayLinkedAt
        ? user
        : await prisma.user.update({
            where: { id: userId },
            data: { sepayLinkedAt: new Date() },
            select: {
              sepayCode: true,
              bankAccountNumber: true,
              sepayLinkedAt: true,
            },
          })

      return sendSuccess(res, toBankLinkResponse(currentUser))
    }

    const uniqueCode = await generateUniqueSepayCode()
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        sepayCode: uniqueCode,
        ...(user.sepayLinkedAt ? {} : { sepayLinkedAt: new Date() }),
      },
      select: {
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
      },
    })

    return sendSuccess(res, toBankLinkResponse(updatedUser))
  } catch (error) {
    console.error('linkBank error:', error)
    return sendError(res, 'Loi khi lien ket ngan hang', 500)
  }
}

async function getBankLink(req, res) {
  const userId = req.user.userId

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
      },
    })

    if (!user) {
      return sendError(res, 'Khong tim thay nguoi dung', 404)
    }

    return sendSuccess(res, toBankLinkResponse(user))
  } catch (error) {
    console.error('getBankLink error:', error)
    return sendError(res, 'Loi khi lay thong tin lien ket ngan hang', 500)
  }
}

async function regenerateBankLink(req, res) {
  const userId = req.user.userId
  const confirmed = req.body?.confirm === true

  if (!confirmed) {
    return sendError(
      res,
      'Can xac nhan truoc khi doi ma. Ma cu se khong con match giao dich moi.',
      400
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
      },
    })

    if (!user) {
      return sendError(res, 'Khong tim thay nguoi dung', 404)
    }

    if (!user.sepayCode) {
      return sendError(res, 'Chua co ma SePay de doi. Hay lien ket ngan hang truoc.', 400)
    }

    const previousSepayCode = user.sepayCode
    const uniqueCode = await generateUniqueSepayCode()
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        sepayCode: uniqueCode,
        ...(user.sepayLinkedAt ? {} : { sepayLinkedAt: new Date() }),
      },
      select: {
        sepayCode: true,
        bankAccountNumber: true,
        sepayLinkedAt: true,
      },
    })

    return sendSuccess(
      res,
      toBankLinkResponse(updatedUser, {
        previousSepayCode,
        warning: 'Ma cu se khong con match giao dich moi.',
      })
    )
  } catch (error) {
    console.error('regenerateBankLink error:', error)
    return sendError(res, 'Loi khi doi ma lien ket ngan hang', 500)
  }
}

async function unlinkBank(req, res) {
  const userId = req.user.userId

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        bankAccountNumber: null,
        sepayLinkedAt: null,
      },
    })

    return sendSuccess(res, { message: 'Huy lien ket ngan hang thanh cong' })
  } catch (error) {
    console.error('unlinkBank error:', error)
    return sendError(res, 'Loi khi huy lien ket ngan hang', 500)
  }
}

module.exports = {
  linkBank,
  getBankLink,
  regenerateBankLink,
  unlinkBank,
}
