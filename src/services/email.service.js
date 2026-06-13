const SENDGRID_MAIL_SEND_URL = 'https://api.sendgrid.com/v3/mail/send'
const SENDGRID_TIMEOUT_MS = 20000
const MAX_SENDGRID_ATTEMPTS = 3

const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
])

const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const PERMANENT_STATUS_CODES = new Set([400, 401, 403, 404, 413])

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getEmailConfig() {
  const apiKey = process.env.SENDGRID_API_KEY || process.env.SMTP_PASS
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM_EMAIL
  const fromName =
    process.env.SENDGRID_FROM_NAME ||
    process.env.SMTP_FROM_NAME ||
    process.env.APP_NAME ||
    'FinTrack'

  if (!apiKey) {
    throw new Error('Thiếu SENDGRID_API_KEY hoặc SMTP_PASS để gửi email qua SendGrid Web API.')
  }

  if (!fromEmail) {
    throw new Error('Thiếu SENDGRID_FROM_EMAIL hoặc SMTP_FROM_EMAIL.')
  }

  return { apiKey, fromEmail, fromName }
}

function getSendGridErrorMessage(statusCode, body) {
  const errors = body?.errors

  if (Array.isArray(errors) && errors.length > 0 && errors[0]?.message) {
    return `SendGrid lỗi ${statusCode}: ${errors[0].message}`
  }

  if (statusCode === 401) {
    return 'SendGrid từ chối xác thực. Hãy kiểm tra SENDGRID_API_KEY hoặc SMTP_PASS.'
  }

  if (statusCode === 403) {
    return 'SendGrid từ chối gửi email. Hãy kiểm tra sender/domain đã verify trong SendGrid.'
  }

  return `SendGrid trả về lỗi ${statusCode}.`
}

async function readResponseBody(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function createSendGridError({ statusCode, body }) {
  const error = new Error(getSendGridErrorMessage(statusCode, body))
  error.statusCode = statusCode
  error.code = 'SENDGRID_API_ERROR'
  return error
}

function normalizeFetchError(error) {
  if (error?.name === 'AbortError') {
    const timeoutError = new Error('SendGrid request timed out.')
    timeoutError.code = 'ETIMEDOUT'
    return timeoutError
  }

  return error
}

function shouldRetrySendGridError(error) {
  if (PERMANENT_STATUS_CODES.has(error?.statusCode)) {
    return false
  }

  if (TRANSIENT_STATUS_CODES.has(error?.statusCode)) {
    return true
  }

  return TRANSIENT_NETWORK_ERROR_CODES.has(error?.code)
}

function logSendGridSuccess(to, statusCode) {
  console.info('[email] OTP sent', {
    to,
    statusCode,
  })
}

function logSendGridFailure(to, error) {
  console.error('[email] OTP send failed', {
    to,
    statusCode: error?.statusCode,
    code: error?.code,
    message: error?.message || 'Không thể gửi email OTP qua SendGrid.',
  })
}

async function postSendGridMail(payload, apiKey) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SENDGRID_TIMEOUT_MS)

  try {
    const response = await fetch(SENDGRID_MAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await readResponseBody(response)
      throw createSendGridError({
        statusCode: response.status,
        body,
      })
    }

    return {
      statusCode: response.status,
    }
  } catch (error) {
    throw normalizeFetchError(error)
  } finally {
    clearTimeout(timeout)
  }
}

async function sendSendGridMailWithRetry(to, payload, apiKey) {
  let lastError

  for (let attempt = 1; attempt <= MAX_SENDGRID_ATTEMPTS; attempt += 1) {
    try {
      const result = await postSendGridMail(payload, apiKey)
      logSendGridSuccess(to, result.statusCode)
      return result
    } catch (error) {
      lastError = error

      if (!shouldRetrySendGridError(error) || attempt === MAX_SENDGRID_ATTEMPTS) {
        logSendGridFailure(to, error)
        break
      }

      await delay(500 * attempt)
    }
  }

  throw lastError
}

function createOtpEmailHtml({
  name,
  otp,
  expiresInMinutes,
  appName,
  title,
  intro,
}) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6">
      <h2 style="margin: 0 0 16px">${appName} - ${title}</h2>
      <p>Xin chào ${name || 'bạn'},</p>
      <p>${intro}</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 16px 20px; background: #f8fafc; border: 1px solid #e2e8f0; display: inline-block; border-radius: 12px;">${otp}</div>
      <p style="margin-top: 16px">Mã này sẽ hết hạn sau ${expiresInMinutes} phút.</p>
      <p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.</p>
    </div>
  `
}

function createOtpEmailContent({
  to,
  name,
  otp,
  expiresInMinutes,
  title,
  intro,
}) {
  const appName = process.env.APP_NAME || 'FinTrack'

  return {
    to,
    subject: `${appName} - ${title}`,
    text: `Mã OTP của bạn là ${otp}. Mã này hết hạn sau ${expiresInMinutes} phút.`,
    html: createOtpEmailHtml({
      name,
      otp,
      expiresInMinutes,
      appName,
      title,
      intro,
    }),
  }
}

function createSendGridPayload({ to, subject, text, html }, { fromEmail, fromName }) {
  return {
    personalizations: [
      {
        to: [{ email: to }],
      },
    ],
    from: {
      email: fromEmail,
      name: fromName,
    },
    subject,
    content: [
      {
        type: 'text/plain',
        value: text,
      },
      {
        type: 'text/html',
        value: html,
      },
    ],
  }
}

async function sendOtpEmail({
  to,
  name,
  otp,
  expiresInMinutes = 10,
  title,
  intro,
}) {
  const emailConfig = getEmailConfig()
  const content = createOtpEmailContent({
    to,
    name,
    otp,
    expiresInMinutes,
    title,
    intro,
  })
  const payload = createSendGridPayload(content, emailConfig)

  await sendSendGridMailWithRetry(to, payload, emailConfig.apiKey)

  return { delivered: true, provider: 'sendgrid' }
}

async function sendPasswordResetOtpEmail({ to, name, otp, expiresInMinutes = 10 }) {
  return sendOtpEmail({
    to,
    name,
    otp,
    expiresInMinutes,
    title: 'Mã OTP đặt lại mật khẩu',
    intro: 'Mã OTP đặt lại mật khẩu của bạn là:',
  })
}

async function sendRegistrationOtpEmail({ to, name, otp, expiresInMinutes = 10 }) {
  return sendOtpEmail({
    to,
    name,
    otp,
    expiresInMinutes,
    title: 'Mã OTP xác thực đăng ký',
    intro: 'Mã OTP xác thực email đăng ký của bạn là:',
  })
}

module.exports = {
  sendPasswordResetOtpEmail,
  sendRegistrationOtpEmail,
}
