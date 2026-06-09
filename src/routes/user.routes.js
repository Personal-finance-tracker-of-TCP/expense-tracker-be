const { Router } = require('express')
const authMiddleware = require('../middlewares/auth.middleware')
const userController = require('../controllers/user.controller')

const router = Router()

router.use(authMiddleware)

router.patch('/me/balance', userController.updateMyBalance)
router.patch('/me/sepay-sandbox-link', userController.updateMySepaySandboxLink)

module.exports = router
