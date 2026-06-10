const { Router } = require('express')
const adminController = require('../controllers/admin.controller')
const authMiddleware = require('../middlewares/auth.middleware')
const prisma = require('../lib/prisma')

const adminRoutes = Router()

async function requireAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    })

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền truy cập endpoint này',
      })
    }

    return next()
  } catch (err) {
    return next(err)
  }
}

adminRoutes.use(authMiddleware)
adminRoutes.use(requireAdmin)

adminRoutes.post('/sepay-simulator', adminController.simulateSepay)
adminRoutes.post(
  '/bankhub-sandbox/transactions',
  adminController.createBankHubSandboxTransaction
)
adminRoutes.get('/platform-statistics', adminController.getPlatformStatistics)
adminRoutes.post('/notifications', adminController.createNotification)
adminRoutes.get('/sepay-logs', adminController.getSepayLogs)
adminRoutes.get('/linked-users', adminController.getLinkedUsers)

module.exports = adminRoutes
