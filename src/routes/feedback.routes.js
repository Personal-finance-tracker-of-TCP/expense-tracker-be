const { Router } = require('express')
const feedbackController = require('../controllers/feedback.controller')

const router = Router()

router.post('/', feedbackController.createFeedback)

module.exports = router
