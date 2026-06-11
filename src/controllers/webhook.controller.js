const webhookService = require('../services/webhook.service')
const { sendSuccess, sendError } = require('../utils/response')

function getStatusCode(error) {
  return error.statusCode || 500
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] || ''
  }

  return typeof value === 'string' ? value : ''
}

function maskSecretForDebug(value) {
  const text = normalizeHeaderValue(value).trim()

  if (!text) {
    return {
      length: 0,
      prefix: '',
      suffix: '',
    }
  }

  return {
    length: text.length,
    prefix: text.slice(0, 3),
    suffix: text.slice(-3),
  }
}

function maskAuthorizationHeader(value) {
  const authorizationHeader = normalizeHeaderValue(value)
  const authParts = authorizationHeader.match(/^(\S+)\s+(.+)$/)

  if (!authorizationHeader) {
    return null
  }

  if (!authParts) {
    return {
      scheme: null,
      secret: maskSecretForDebug(authorizationHeader),
    }
  }

  return {
    scheme: authParts[1],
    secret: maskSecretForDebug(authParts[2]),
  }
}

function maskHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const lowerKey = key.toLowerCase()

      if (lowerKey === 'authorization') {
        return [key, maskAuthorizationHeader(value)]
      }

      if (lowerKey === 'x-sepay-secret') {
        return [key, maskSecretForDebug(value)]
      }

      if (lowerKey === 'cookie') {
        return [key, '[masked]']
      }

      return [key, value]
    })
  )
}

function getProvidedWebhookSecret(req) {
  const secretHeader = normalizeHeaderValue(req.headers['x-sepay-secret']).trim()
  const authorizationHeader = normalizeHeaderValue(req.headers.authorization)
  const authParts = authorizationHeader.match(/^(\S+)\s+(.+)$/)
  const authorizationScheme = authParts?.[1] || ''
  const authorizationSecret = authParts?.[2]?.trim() || ''
  const normalizedScheme = authorizationScheme.toLowerCase()

  if (secretHeader) {
    return {
      providedSecret: secretHeader,
      authorizationHeaderExists: Boolean(authorizationHeader),
      authorizationScheme,
      source: 'x-sepay-secret',
    }
  }

  if (['apikey', 'bearer'].includes(normalizedScheme) && authorizationSecret) {
    return {
      providedSecret: authorizationSecret,
      authorizationHeaderExists: true,
      authorizationScheme,
      source: 'authorization',
    }
  }

  return {
    providedSecret: '',
    authorizationHeaderExists: Boolean(authorizationHeader),
    authorizationScheme,
    source: authorizationHeader ? 'authorization-unsupported' : 'missing',
  }
}

function getProvidedApiKey(req) {
  const authorizationHeader = normalizeHeaderValue(req.headers.authorization)
  const authParts = authorizationHeader.match(/^(\S+)\s+(.+)$/)
  const authorizationScheme = authParts?.[1] || ''
  const authorizationSecret = authParts?.[2]?.trim() || ''

  if (authorizationScheme.toLowerCase() === 'apikey' && authorizationSecret) {
    return authorizationSecret
  }

  return ''
}

function logReceivedWebhook(req) {
  console.info('[SePay Webhook] received', {
    method: req.method,
    originalUrl: req.originalUrl,
    authorization: maskAuthorizationHeader(req.headers.authorization),
    body: req.body,
  })
}

function logReceivedBankhubWebhook(req) {
  if (process.env.NODE_ENV === 'production') return

  console.info('[SePay BankHub Webhook] received', {
    method: req.method,
    originalUrl: req.originalUrl,
    headers: maskHeaders(req.headers),
    body: req.body,
  })
}

function logWebhookAuthDebug(context, debug) {
  console.info('SePay webhook auth debug', {
    context,
    authorizationHeaderExists: debug.authorizationHeaderExists,
    authorizationScheme: debug.authorizationScheme || null,
    source: debug.source,
    providedSecret: maskSecretForDebug(debug.providedSecret),
    envSecret: maskSecretForDebug(debug.envSecret),
  })
}

async function getWebhookHealth(req, res) {
  return sendSuccess(res, {
    status: 'ok',
    route: 'POST /api/webhooks/sepay',
    message: 'Webhook endpoint is reachable',
  })
}

async function handleSepayWebhook(req, res) {
  logReceivedWebhook(req)

  const expectedSecret = normalizeHeaderValue(process.env.SEPAY_WEBHOOK_SECRET).trim()

  if (!expectedSecret) {
    return sendError(res, 'SEPAY_WEBHOOK_SECRET is not configured', 500)
  }

  const authDebug = {
    ...getProvidedWebhookSecret(req),
    envSecret: expectedSecret,
  }
  const providedSecret = authDebug.providedSecret.trim()

  if (!providedSecret || providedSecret !== expectedSecret) {
    logWebhookAuthDebug('mismatch', authDebug)
    return sendError(res, 'SePay secret khong hop le', 401)
  }

  logWebhookAuthDebug('success', authDebug)

  try {
    const result = await webhookService.processSepayWebhook(req.body)
    return sendSuccess(res, result)
  } catch (err) {
    console.error('handleSepayWebhook error:', err)
    return sendError(res, err.message || 'Loi khi xu ly webhook SePay', getStatusCode(err))
  }
}

async function handleSepayBankhubWebhook(req, res) {
  logReceivedBankhubWebhook(req)

  const expectedApiKey = normalizeHeaderValue(
    process.env.SEPAY_BANKHUB_IPN_API_KEY
  ).trim()

  if (expectedApiKey) {
    const providedApiKey = getProvidedApiKey(req).trim()

    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      console.info('SePay BankHub IPN auth mismatch', {
        authorizationHeaderExists: Boolean(req.headers.authorization),
        providedKey: maskSecretForDebug(providedApiKey),
        envKey: maskSecretForDebug(expectedApiKey),
      })
      return sendError(res, 'SePay BankHub IPN api key khong hop le', 401)
    }
  }

  try {
    const result = await webhookService.processSepayBankhubWebhook(req.body)
    return res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.error('handleSepayBankhubWebhook error:', err.message)
    return sendError(
      res,
      err.message || 'Loi khi xu ly webhook SePay BankHub',
      getStatusCode(err)
    )
  }
}

async function simulateSepay(req, res) {
  try {
    const payload = {
      ...req.body,
      sepayId: req.body?.sepayId || `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }

    const result = await webhookService.processSepayWebhook(payload)
    return sendSuccess(res, result, result.status === 'PROCESSED' ? 201 : 200)
  } catch (err) {
    console.error('simulateSepay error:', err)
    return sendError(res, err.message || 'Loi khi gia lap SePay', getStatusCode(err))
  }
}

async function getSepayLogs(req, res) {
  try {
    const result = await webhookService.getSepayLogs(req.query)
    return sendSuccess(res, result)
  } catch (err) {
    console.error('getSepayLogs error:', err)
    return sendError(res, 'Loi khi lay log SePay', 500)
  }
}

module.exports = {
  getWebhookHealth,
  handleSepayWebhook,
  handleSepayBankhubWebhook,
  simulateSepay,
  getSepayLogs,
}
