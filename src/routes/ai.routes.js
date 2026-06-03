const { Router } = require('express')
const aiController = require('../controllers/ai.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)

router.post('/advice', aiController.getAdvice)

module.exports = router
