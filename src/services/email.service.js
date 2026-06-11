const sgMail = require('@sendgrid/mail')

let isConfigured = false

function formatSendGridError(error) {
  const statusCode = error?.response?.statusCode || error?.code

  if (statusCode === 403 || statusCode === '403') {
    return 'SendGrid trả về 403 Forbidden. Hãy kiểm tra SENDGRID_FROM_EMAIL đã được verify trong SendGrid hoặc domain authentication đã được cấu hình đúng.'
  }

  const sendGridErrors = error?.response?.body?.errors
  if (Array.isArray(sendGridErrors) && sendGridErrors.length > 0) {
    const firstError = sendGridErrors[0]
    if (firstError?.message) {
      return `SendGrid lỗi: ${firstError.message}`
    }
  }

  return error?.message || 'Không thể gửi email đặt lại mật khẩu'
}

function getSendGridConfig() {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL

  if (!apiKey) {
    throw new Error('Thiếu SENDGRID_API_KEY')
  }

  if (!fromEmail) {
    throw new Error('Thiếu SENDGRID_FROM_EMAIL')
  }

  return { apiKey, fromEmail }
}

function ensureSendGridConfigured() {
  if (isConfigured) return

  const { apiKey } = getSendGridConfig()
  sgMail.setApiKey(apiKey)
  isConfigured = true
}

function createPasswordResetEmailHtml({ name, otp, expiresInMinutes, appName }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6">
      <h2 style="margin: 0 0 16px">${appName} - Mã xác thực đặt lại mật khẩu</h2>
      <p>Xin chào ${name || 'bạn'},</p>
      <p>Mã OTP của bạn là:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 16px 20px; background: #f8fafc; border: 1px solid #e2e8f0; display: inline-block; border-radius: 12px;">${otp}</div>
      <p style="margin-top: 16px">Mã này sẽ hết hạn sau ${expiresInMinutes} phút.</p>
      <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
    </div>
  `
}

async function sendPasswordResetOtpEmail({ to, name, otp, expiresInMinutes = 10 }) {
  ensureSendGridConfigured()

  const { fromEmail } = getSendGridConfig()
  const appName = process.env.APP_NAME || 'MoneyTrack'

  try {
    await sgMail.send({
      to,
      from: fromEmail,
      subject: `${appName} - Mã OTP đặt lại mật khẩu`,
      text: `Mã OTP của bạn là ${otp}. Mã này hết hạn sau ${expiresInMinutes} phút.`,
      html: createPasswordResetEmailHtml({ name, otp, expiresInMinutes, appName }),
    })
  } catch (error) {
    throw new Error(formatSendGridError(error))
  }
}

module.exports = {
  sendPasswordResetOtpEmail,
}