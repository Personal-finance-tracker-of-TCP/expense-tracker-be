const { Router } = require('express')
const webhookController = require('../controllers/webhook.controller')

const webhookRoutes = Router()

webhookRoutes.post('/sepay', webhookController.handleSepayWebhook)

module.exports = {
  webhookRoutes,
}

