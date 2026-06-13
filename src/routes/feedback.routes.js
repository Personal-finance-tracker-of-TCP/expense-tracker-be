const { Router } = require('express')
const feedbackController = require('../controllers/feedback.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)
router.post('/', feedbackController.createFeedback)

module.exports = router
