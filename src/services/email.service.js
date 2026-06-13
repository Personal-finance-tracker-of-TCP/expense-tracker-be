const dns = require('dns')
const nodemailer = require('nodemailer')

dns.setDefaultResultOrder('ipv4first')

const TRANSIENT_SMTP_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNECTION',
  'ESOCKET',
  'ECONNRESET',
  'EAI_AGAIN',
])

let smtpTransporter = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientSmtpError(error) {
  return TRANSIENT_SMTP_ERROR_CODES.has(error?.code)
}

function formatSmtpError(error) {
  if (error?.code === 'EAUTH' || error?.responseCode === 535) {
    return 'SMTP từ chối đăng nhập. Với SendGrid, SMTP_USER phải là "apikey" và SMTP_PASS phải là SendGrid API Key.'
  }

  if (
    error?.code === 'ECONNECTION' ||
    error?.code === 'ETIMEDOUT' ||
    error?.code === 'ENETUNREACH' ||
    error?.code === 'ESOCKET' ||
    error?.code === 'ECONNRESET' ||
    error?.code === 'EAI_AGAIN'
  ) {
    return 'Không thể kết nối máy chủ SMTP. Hãy kiểm tra SMTP_HOST, SMTP_PORT, SMTP_SECURE và mạng.'
  }

  return error?.message || 'Không thể gửi email OTP qua SMTP'
}

function logSafeSmtpError(error, attempt) {
  console.error('SMTP send failed:', {
    attempt,
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    message: formatSmtpError(error),
  })
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const fromEmail = process.env.SMTP_FROM_EMAIL || user
  const fromName = process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'FinTrack'

  if (!host) {
    throw new Error('Thiếu SMTP_HOST')
  }

  if (!user) {
    throw new Error('Thiếu SMTP_USER')
  }

  if (!pass) {
    throw new Error('Thiếu SMTP_PASS. Với SendGrid, SMTP_PASS phải là SendGrid API Key.')
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SMTP_PORT không hợp lệ')
  }

  return { host, port, secure, user, pass, fromEmail, fromName }
}

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter

  const { host, port, secure, user, pass } = getSmtpConfig()
  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    family: 4,
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    auth: {
      user,
      pass,
    },
  })

  return smtpTransporter
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

async function sendMailWithRetry(transporter, mailOptions, maxAttempts = 2) {
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await transporter.sendMail(mailOptions)
    } catch (error) {
      lastError = error
      logSafeSmtpError(error, attempt)

      if (!isTransientSmtpError(error) || attempt === maxAttempts) {
        break
      }

      smtpTransporter = null
      await delay(500 * attempt)
      transporter = getSmtpTransporter()
    }
  }

  throw lastError
}

async function sendOtpBySmtp(content) {
  const { fromEmail, fromName } = getSmtpConfig()
  const transporter = getSmtpTransporter()

  try {
    await sendMailWithRetry(transporter, {
      from: `"${fromName}" <${fromEmail}>`,
      ...content,
    })

    return { delivered: true, provider: 'smtp' }
  } catch (error) {
    throw new Error(formatSmtpError(error))
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
  const content = createOtpEmailContent({
    to,
    name,
    otp,
    expiresInMinutes,
    title,
    intro,
  })

  return sendOtpBySmtp(content)
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
