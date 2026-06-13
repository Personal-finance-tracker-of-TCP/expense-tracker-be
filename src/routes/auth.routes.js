const router = require('express').Router()
const authMiddleware = require('../middlewares/auth.middleware')
const {
  requestRegisterOtpController,
  registerController,
  loginController,
  googleLoginController,
  refreshTokenController,
  logoutUserController,
  getMeController,
  forgotPasswordController,
  verifyResetOtpController,
  resetPasswordController,
} = require('../controllers/auth.controller')

router.post('/register/request-otp', requestRegisterOtpController)
router.post('/register', registerController)
router.post('/login', loginController)
router.post('/google', googleLoginController)
router.post('/refresh', refreshTokenController)
router.post('/forgot-password', forgotPasswordController)
router.post('/forgot-password/verify-otp', verifyResetOtpController)
router.post('/reset-password', resetPasswordController)
router.post('/logout', authMiddleware, logoutUserController)
router.get('/me', authMiddleware, getMeController)

module.exports = router
