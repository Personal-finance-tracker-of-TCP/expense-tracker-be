const { Router } = require('express')
const notificationController = require('../controllers/notification.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const router = Router()

router.use(authMiddleware)

router.get('/', notificationController.getNotifications)
router.patch('/read-all', notificationController.readAllNotifications)
router.patch('/:id/read', notificationController.readNotification)

module.exports = router
