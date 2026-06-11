const BANKHUB_DEFAULT_BASE_URL = 'https://bankhub-api-sandbox.sepay.vn'
const TOKEN_EXPIRY_SAFETY_MS = 60 * 1000

let cachedAccessToken = null
let cachedAccessTokenExpiresAt = 0

function getBankHubBaseUrl() {
  return (process.env.BANKHUB_API_BASE_URL || BANKHUB_DEFAULT_BASE_URL).replace(
    /\/+$/,
    ''
  )
}

function getBankHubCredentials() {
  const clientId = process.env.BANKHUB_CLIENT_ID
  const clientSecret = process.env.BANKHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    const error = new Error('Chua cau hinh BANKHUB_CLIENT_ID hoac BANKHUB_CLIENT_SECRET')
    error.statusCode = 500
    throw error
  }

  return { clientId, clientSecret }
}

async function parseResponseBody(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function getUpstreamMessage(body, fallback) {
  return (
    body?.message ||
    body?.messages?.[0] ||
    body?.error_description ||
    body?.error ||
    fallback
  )
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function extractAccessToken(responseBody) {
  return (
    responseBody?.access_token ||
    responseBody?.data?.access_token ||
    responseBody?.token ||
    responseBody?.data?.token ||
    null
  )
}

function extractExpiresIn(responseBody) {
  const expiresIn =
    responseBody?.expires_in ||
    responseBody?.expiresIn ||
    responseBody?.data?.expires_in ||
    responseBody?.data?.expiresIn

  const numericExpiresIn = Number(expiresIn)
  return Number.isFinite(numericExpiresIn) && numericExpiresIn > 0
    ? numericExpiresIn
    : 0
}

function cacheAccessToken(accessToken, expiresIn) {
  cachedAccessToken = accessToken

  if (expiresIn > 0) {
    cachedAccessTokenExpiresAt =
      Date.now() + expiresIn * 1000 - TOKEN_EXPIRY_SAFETY_MS
    return
  }

  cachedAccessTokenExpiresAt = 0
}

async function getBankhubAccessToken() {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now()) {
    return cachedAccessToken
  }

  const { clientId, clientSecret } = getBankHubCredentials()
  const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(`${getBankHubBaseUrl()}/v1/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  const body = await parseResponseBody(response)

  if (!response.ok) {
    throw createServiceError(
      getUpstreamMessage(body, 'Khong the lay BankHub access token'),
      response.status || 502
    )
  }

  const accessToken = extractAccessToken(body)
  if (!accessToken) {
    throw createServiceError('BankHub khong tra ve access token', 502)
  }

  cacheAccessToken(accessToken, extractExpiresIn(body))
  return accessToken
}

async function bankhubRequest(path, options = {}) {
  const accessToken = await getBankhubAccessToken()
  const response = await fetch(`${getBankHubBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const body = await parseResponseBody(response)

  if (!response.ok) {
    throw createServiceError(
      getUpstreamMessage(body, 'BankHub request failed'),
      response.status || 502
    )
  }

  return body
}

function pickFirst(...values) {
  for (const value of values) {
    if (value === null || typeof value === 'undefined') continue
    const text = String(value).trim()
    if (text) return text
  }

  return null
}

function extractCompanyXid(responseBody = {}) {
  return pickFirst(
    responseBody.company_xid,
    responseBody.xid,
    responseBody.id,
    responseBody.data?.company_xid,
    responseBody.data?.xid,
    responseBody.data?.id
  )
}

async function createCompany() {
  const body = await bankhubRequest('/v1/company/create', {
    method: 'POST',
    body: JSON.stringify({
      full_name: process.env.BANKHUB_COMPANY_NAME || 'MoneyTrack Sandbox',
      status: 'Active',
    }),
  })
  const companyXid = extractCompanyXid(body)

  if (!companyXid) {
    throw createServiceError('BankHub khong tra ve companyXid', 502)
  }

  return {
    companyXid,
    raw: body,
  }
}

function extractLinkTokenResponse(responseBody = {}) {
  const data = responseBody.data || {}

  return {
    hosted_link_url: pickFirst(
      responseBody.hosted_link_url,
      responseBody.hostedLinkUrl,
      data.hosted_link_url,
      data.hostedLinkUrl
    ),
    link_token: pickFirst(
      responseBody.link_token,
      responseBody.linkToken,
      data.link_token,
      data.linkToken
    ),
    xid: pickFirst(responseBody.xid, responseBody.id, data.xid, data.id),
    expires_at: pickFirst(
      responseBody.expires_at,
      responseBody.expiresAt,
      data.expires_at,
      data.expiresAt
    ),
  }
}

async function createLinkToken() {
  let companyXid = process.env.BANKHUB_COMPANY_XID
  let createdCompany = null

  if (!companyXid) {
    createdCompany = await createCompany()
    companyXid = createdCompany.companyXid
  }

  const body = await bankhubRequest('/v1/link-token/create', {
    method: 'POST',
    body: JSON.stringify({
      company_xid: companyXid,
      purpose: 'LINK_BANK_ACCOUNT',
    }),
  })

  return {
    ...extractLinkTokenResponse(body),
    companyXid,
    createdCompanyXid: createdCompany?.companyXid || null,
    raw: body,
  }
}

async function listBankAccounts() {
  return bankhubRequest('/v1/bank-account', {
    method: 'GET',
  })
}

function getAccountArray(responseBody = {}) {
  if (Array.isArray(responseBody)) return responseBody
  if (Array.isArray(responseBody.data)) return responseBody.data
  if (Array.isArray(responseBody.data?.data)) return responseBody.data.data
  if (Array.isArray(responseBody.accounts)) return responseBody.accounts
  if (Array.isArray(responseBody.bank_accounts)) return responseBody.bank_accounts
  if (Array.isArray(responseBody.items)) return responseBody.items
  return []
}

function normalizeBankhubAccounts(responseBody = {}) {
  return getAccountArray(responseBody).map((account) => ({
    bankhubAccountXid: pickFirst(
      account.xid,
      account.bank_account_xid,
      account.bankHubAccountXid,
      account.bankhubAccountXid,
      account.account_xid,
      account.id
    ),
    bankAccountNumber: pickFirst(
      account.account_number,
      account.accountNumber,
      account.number
    ),
    bankName: pickFirst(account.brand_name, account.bank_name, account.bankName),
    bankAccountName: pickFirst(
      account.account_holder_name,
      account.account_holder,
      account.accountHolder,
      account.owner_name,
      account.account_name
    ),
    status: {
      active: account.active,
      bankApiConnected: account.bank_api_connected,
    },
    raw: account,
  }))
}

function validateMockTransactionPayload(data) {
  if (!data?.bankAccountXid) {
    throw createServiceError('bankAccountXid la bat buoc', 400)
  }

  if (!['credit', 'debit'].includes(data.transferType)) {
    throw createServiceError('transferType chi nhan credit hoac debit', 400)
  }

  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
    throw createServiceError('amount phai lon hon 0', 400)
  }
}

async function createMockTransaction({
  bankAccountXid,
  transferType,
  amount,
  content,
}) {
  const payload = {
    bankAccountXid,
    transferType,
    amount,
    content,
  }
  validateMockTransactionPayload(payload)

  return bankhubRequest('/v1/transaction/create', {
    method: 'POST',
    body: JSON.stringify({
      bank_account_xid: bankAccountXid,
      transfer_type: transferType,
      amount,
      transaction_content: content,
    }),
  })
}

module.exports = {
  getBankhubAccessToken,
  createCompany,
  createLinkToken,
  listBankAccounts,
  normalizeBankhubAccounts,
  createMockTransaction,
}
