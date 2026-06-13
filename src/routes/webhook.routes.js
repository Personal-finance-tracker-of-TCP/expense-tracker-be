const { Router } = require('express')
const webhookController = require('../controllers/webhook.controller')

const webhookRoutes = Router()

webhookRoutes.get('/health', webhookController.getWebhookHealth)
webhookRoutes.post('/sepay', webhookController.handleSepayWebhook)
webhookRoutes.post('/sepay-bankhub', webhookController.handleSepayBankhubWebhook)

module.exports = {
  webhookRoutes,
}

