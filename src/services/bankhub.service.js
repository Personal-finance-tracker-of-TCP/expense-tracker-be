const BANKHUB_DEFAULT_BASE_URL = 'https://bankhub-api.sepay.vn'
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
    const error = new Error(
      getUpstreamMessage(body, 'Khong the lay BankHub access token')
    )
    error.statusCode = response.status || 502
    throw error
  }

  const accessToken = extractAccessToken(body)
  if (!accessToken) {
    const error = new Error('BankHub khong tra ve access token')
    error.statusCode = 502
    throw error
  }

  cacheAccessToken(accessToken, extractExpiresIn(body))
  return accessToken
}

function validateMockTransactionPayload(data) {
  if (!data?.bankAccountXid) {
    const error = new Error('bankAccountXid la bat buoc')
    error.statusCode = 400
    throw error
  }

  if (!['credit', 'debit'].includes(data.transferType)) {
    const error = new Error('transferType chi nhan credit hoac debit')
    error.statusCode = 400
    throw error
  }

  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
    const error = new Error('amount phai lon hon 0')
    error.statusCode = 400
    throw error
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

  const accessToken = await getBankhubAccessToken()
  const response = await fetch(`${getBankHubBaseUrl()}/v1/transaction/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bank_account_xid: bankAccountXid,
      transfer_type: transferType,
      amount,
      transaction_content: content,
    }),
  })
  const body = await parseResponseBody(response)

  if (!response.ok) {
    const error = new Error(
      getUpstreamMessage(body, 'Khong the tao giao dich sandbox tren BankHub')
    )
    error.statusCode = response.status || 502
    throw error
  }

  return body
}

module.exports = {
  getBankhubAccessToken,
  createMockTransaction,
}
