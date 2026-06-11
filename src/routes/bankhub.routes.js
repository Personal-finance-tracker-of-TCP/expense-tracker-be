const { Router } = require('express')
const bankhubController = require('../controllers/bankhub.controller')
const authMiddleware = require('../middlewares/auth.middleware')
const prisma = require('../lib/prisma')

const router = Router()

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
  } catch (error) {
    return next(error)
  }
}

router.use(authMiddleware)

router.post('/hosted-link', bankhubController.createHostedLink)
router.post('/sync-linked-account', bankhubController.syncLinkedAccount)
router.get('/linked-accounts', requireAdmin, bankhubController.getLinkedAccounts)

module.exports = router
