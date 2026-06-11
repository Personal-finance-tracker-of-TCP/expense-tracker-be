const prisma = require('../lib/prisma')
const bankhubService = require('../services/bankhub.service')
const { sendSuccess, sendError } = require('../utils/response')

function getStatusCode(error) {
  return error.statusCode || 500
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

async function createHostedLink(req, res) {
  try {
    const link = await bankhubService.createLinkToken()

    return sendSuccess(res, {
      hostedLinkUrl: link.hosted_link_url,
      hosted_link_url: link.hosted_link_url,
      linkToken: link.link_token,
      link_token: link.link_token,
      xid: link.xid,
      expiresAt: link.expires_at,
      expires_at: link.expires_at,
      companyXid: link.companyXid,
      createdCompanyXid: link.createdCompanyXid,
    })
  } catch (error) {
    console.error('createHostedLink error:', error.message)
    return sendError(
      res,
      error.message || 'Khong the tao BankHub hosted link',
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
    console.error('syncLinkedAccount error:', error.message)
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
    console.error('getLinkedAccounts error:', error.message)
    return sendError(
      res,
      error.message || 'Khong the lay danh sach tai khoan BankHub',
      getStatusCode(error)
    )
  }
}

module.exports = {
  createHostedLink,
  syncLinkedAccount,
  getLinkedAccounts,
}
