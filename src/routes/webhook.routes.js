const { Router } = require('express')
const webhookController = require('../controllers/webhook.controller')
const authMiddleware = require('../middlewares/auth.middleware')
const prisma = require('../lib/prisma')

const webhookRoutes = Router()
const adminSepayRoutes = Router()

async function requireAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    })

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Chi admin moi co quyen truy cap endpoint nay',
      })
    }

    return next()
  } catch (err) {
    return next(err)
  }
}

webhookRoutes.post('/sepay', webhookController.handleSepayWebhook)

adminSepayRoutes.use(authMiddleware)
adminSepayRoutes.use(requireAdmin)
adminSepayRoutes.post('/sepay-simulator', webhookController.simulateSepay)
adminSepayRoutes.get('/sepay-logs', webhookController.getSepayLogs)

module.exports = {
  webhookRoutes,
  adminSepayRoutes,
}
