const prisma = require('../lib/prisma')
const bankhubService = require('../services/bankhub.service')
const { sendSuccess, sendError } = require('../utils/response')

function getStatusCode(error) {
  return error.statusCode || 500
}

function getSafeErrorLogMessage(error) {
  const message = error?.message || ''

  if (message.includes('<!DOCTYPE html') || message.length > 500) {
    return `${message.slice(0, 300)}...`
  }

  return message
}

function getSafeUrlHost(value) {
  try {
    return value ? new URL(value).host : null
  } catch {
    return null
  }
}

function isActiveBankhubAccount(account) {
  const active = account.status?.active
  const connected = account.status?.bankApiConnected

  return (
    active === true ||
    active === 1 ||
    active === '1' ||
    String(active).toLowerCase() === 'active' ||
    connected === true ||
    connected === 1 ||
    connected === '1'
  )
}

function sanitizeAccountForResponse(account) {
  return {
    bankhubAccountXid: account.bankhubAccountXid,
    bankAccountNumber: account.bankAccountNumber,
    bankName: account.bankName,
    bankAccountName: account.bankAccountName,
    status: account.status,
  }
}

const userBankhubSelect = {
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
}

async function createHostedLink(req, res) {
  try {
    const link = await bankhubService.createLinkToken()
    const hostedLinkHost = getSafeUrlHost(link.hosted_link_url)

    console.info('BankHub hosted link debug', {
      hasHostedLinkUrl: Boolean(link.hosted_link_url),
      hostedLinkHost,
      xid: link.xid || null,
      expiresAt: link.expires_at || null,
    })

    return sendSuccess(res, {
      hostedLinkUrl: link.hosted_link_url,
      hosted_link_url: link.hosted_link_url,
      linkToken: link.link_token,
      xid: link.xid,
      expiresAt: link.expires_at,
    })
  } catch (error) {
    console.error('createHostedLink error:', getSafeErrorLogMessage(error))
    return sendError(
      res,
      error.message || 'Khong the tao BankHub hosted link',
      getStatusCode(error)
    )
  }
}

async function refreshBankhubStatus(req, res) {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: userBankhubSelect,
    })

    if (!currentUser) {
      return sendError(res, 'Khong tim thay user', 404)
    }

    if (!currentUser?.bankhubAccountXid) {
      return sendSuccess(res, {
        ...currentUser,
        isLinked: false,
        message: 'User chua co BankHub XID trong FinTrack',
      })
    }

    const raw = await bankhubService.listBankAccounts()
    const accounts = bankhubService.normalizeBankhubAccounts(raw)
    const matchedAccount = accounts.find(
      (account) => account.bankhubAccountXid === currentUser.bankhubAccountXid
    )

    if (!matchedAccount || !isActiveBankhubAccount(matchedAccount)) {
      const unlinkedUser = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          bankhubAccountXid: null,
          bankAccountNumber: null,
          bankName: null,
          bankAccountName: null,
          sepayLinkedAt: null,
        },
        select: userBankhubSelect,
      })

      return sendSuccess(res, {
        ...unlinkedUser,
        isLinked: false,
        message: 'BankHub da huy lien ket tai khoan nay',
      })
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        bankAccountNumber: matchedAccount.bankAccountNumber,
        bankName: matchedAccount.bankName,
        bankAccountName: matchedAccount.bankAccountName,
      },
      select: userBankhubSelect,
    })

    return sendSuccess(res, {
      ...updatedUser,
      isLinked: true,
    })
  } catch (error) {
    console.error('refreshBankhubStatus error:', error.message)
    return sendError(
      res,
      error.message || 'Khong the lam moi trang thai BankHub',
      getStatusCode(error)
    )
  }
}

async function syncLinkedAccount(req, res) {
  try {
    const raw = await bankhubService.listBankAccounts()
    const accounts = bankhubService
      .normalizeBankhubAccounts(raw)
      .filter((account) => account.bankhubAccountXid)
    const requestedXid = req.body?.bankhubAccountXid
      ? String(req.body.bankhubAccountXid).trim()
      : null

    let selectedAccount = null

    if (requestedXid) {
      selectedAccount = accounts.find(
        (account) => account.bankhubAccountXid === requestedXid
      )

      if (!selectedAccount) {
        return sendError(res, 'Khong tim thay tai khoan BankHub da chon', 404)
      }

      const assignedUser = await prisma.user.findFirst({
        where: {
          bankhubAccountXid: selectedAccount.bankhubAccountXid,
          NOT: { id: req.user.userId },
        },
        select: { id: true },
      })

      if (assignedUser) {
        return sendError(res, 'Tài khoản BankHub này đã được gán cho user khác.', 409)
      }
    } else {
      const activeAccounts = accounts.filter(isActiveBankhubAccount)
      const assignedUsers = await prisma.user.findMany({
        where: {
          bankhubAccountXid: {
            in: activeAccounts.map((account) => account.bankhubAccountXid),
          },
          NOT: {
            id: req.user.userId,
          },
        },
        select: { bankhubAccountXid: true },
      })
      const assignedXids = new Set(
        assignedUsers.map((user) => user.bankhubAccountXid).filter(Boolean)
      )
      const availableAccounts = activeAccounts.filter(
        (account) => !assignedXids.has(account.bankhubAccountXid)
      )

      if (availableAccounts.length === 0) {
        if (activeAccounts.length > 0) {
          return sendError(res, 'Tài khoản BankHub này đã được gán cho user khác.', 409)
        }

        return sendSuccess(res, {
          message: 'Khong co tai khoan BankHub nao chua gan cho user',
          accounts: [],
          isLinked: false,
        })
      }

      if (availableAccounts.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Co nhieu tai khoan BankHub, vui long chon tai khoan can dong bo',
          data: {
            accounts: availableAccounts.map(sanitizeAccountForResponse),
          },
        })
      }

      selectedAccount = availableAccounts[0]
    }

    const assignedUser = await prisma.user.findFirst({
      where: {
        bankhubAccountXid: selectedAccount.bankhubAccountXid,
        NOT: { id: req.user.userId },
      },
      select: { id: true },
    })

    if (assignedUser) {
      return sendError(res, 'Tài khoản BankHub này đã được gán cho user khác.', 409)
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        bankhubAccountXid: selectedAccount.bankhubAccountXid,
        bankAccountNumber: selectedAccount.bankAccountNumber,
        bankName: selectedAccount.bankName,
        bankAccountName: selectedAccount.bankAccountName,
        sepayLinkedAt: new Date(),
      },
      select: {
        bankhubAccountXid: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountName: true,
        sepayLinkedAt: true,
      },
    })

    return sendSuccess(res, {
      ...updatedUser,
      isLinked: Boolean(updatedUser.bankhubAccountXid),
    })
  } catch (error) {
    console.error('syncLinkedAccount error:', getSafeErrorLogMessage(error))
    return sendError(
      res,
      error.message || 'Khong the dong bo tai khoan BankHub',
      getStatusCode(error)
    )
  }
}

async function getLinkedAccounts(req, res) {
  try {
    const raw = await bankhubService.listBankAccounts()
    const accounts = bankhubService.normalizeBankhubAccounts(raw)

    return sendSuccess(res, {
      accounts,
      raw,
    })
  } catch (error) {
    console.error('getLinkedAccounts error:', getSafeErrorLogMessage(error))
    return sendError(
      res,
      error.message || 'Khong the lay danh sach tai khoan BankHub',
      getStatusCode(error)
    )
  }
}

async function unlinkBankhubLocal(req, res) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        bankhubAccountXid: null,
        bankAccountNumber: null,
        bankName: null,
        bankAccountName: null,
        sepayLinkedAt: null,
      },
      select: {
        ...userBankhubSelect,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đã hủy liên kết BankHub trong MoneyTrack. Tài khoản trên SePay Sandbox không bị hủy.',
      data: {
        ...updatedUser,
        isLinked: false,
      },
    })
  } catch (error) {
    console.error('unlinkBankhubLocal error:', getSafeErrorLogMessage(error))
    return sendError(
      res,
      error.message || 'Khong the huy lien ket BankHub trong MoneyTrack',
      getStatusCode(error)
    )
  }
}

module.exports = {
  createHostedLink,
  refreshBankhubStatus,
  syncLinkedAccount,
  getLinkedAccounts,
  unlinkBankhubLocal,
}
