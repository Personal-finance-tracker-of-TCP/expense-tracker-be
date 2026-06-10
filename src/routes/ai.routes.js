const { Router } = require('express')
const aiController = require('../controllers/ai.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)

router.get('/status', aiController.getStatus)
router.post('/advice', aiController.getAdvice)
router.post('/chat', aiController.chat)
router.get('/history', aiController.getHistory)

module.exports = router
