const { Router } = require('express')
const authMiddleware = require('../middlewares/auth.middleware')
const userController = require('../controllers/user.controller')

const router = Router()

router.use(authMiddleware)

router.get('/me', userController.getMyProfile)
router.patch('/me', userController.updateMyProfile)
router.patch('/me/balance', userController.updateMyBalance)
router.patch('/me/sepay-sandbox-link', userController.updateMySepaySandboxLink)
router.patch('/me/password', userController.changeMyPassword)

module.exports = router
