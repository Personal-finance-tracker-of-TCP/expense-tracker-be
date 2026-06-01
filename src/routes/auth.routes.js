const router = require('express').Router()
const authMiddleware = require('../middlewares/auth.middleware')
const {
  registerController,
  loginController,
  refreshTokenController,
  logoutUserController,
  getMeController,
} = require('../controllers/auth.controller')

router.post('/register', registerController)
router.post('/login', loginController)
router.post('/refresh', refreshTokenController)
router.post('/logout', authMiddleware, logoutUserController)
router.get('/me', authMiddleware, getMeController)

module.exports = router
